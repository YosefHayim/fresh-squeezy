#!/usr/bin/env node

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fetchText, runWhenInvokedDirectly } from "./script-support.mjs";

const DOCS_ORIGIN = "https://docs.lemonsqueezy.com";
const INDEX_URL = `${DOCS_ORIGIN}/api/getting-started/requests`;

const outputUrl = new URL(
	"../../shared/lemon-squeezy-api-types.ts",
	import.meta.url,
);
const outputPath = fileURLToPath(outputUrl);
const updateMode = process.argv.includes("--update");

const USER_AGENT =
	"fresh-squeezy-api-type-generator/0.1 (+https://github.com/YosefHayim/fresh-squeezy)";

const loadResources = async () => {
	const indexHtml = await fetchText(INDEX_URL, USER_AGENT);
	const pages = discoverObjectPages(indexHtml);
	const resources = [];

	for (const page of pages) {
		const html = await fetchText(page.url, USER_AGENT);
		const example = extractResourceExample(html, page.resourceType);
		const isExampleMissing = !example;
		if (isExampleMissing) continue;
		resources.push({ ...page, attributes: example.attributes ?? {} });
	}

	const isThereNoResource = resources.length === 0;
	if (isThereNoResource) {
		throw new Error(
			"No resource examples were discovered from Lemon Squeezy docs.",
		);
	}
	return resources;
};

const writeOrCompare = async (generated, resourceCount) => {
	const isOutputMissing = !existsSync(outputPath);
	const shouldWriteOutput = updateMode || isOutputMissing;
	if (shouldWriteOutput) {
		const outputFolder = dirname(outputPath);
		await mkdir(outputFolder, { recursive: true });
		await writeFile(outputPath, generated, "utf8");
		process.stdout.write(`Generated ${outputPath}\n`);
		process.stdout.write(`  resources: ${resourceCount}\n`);
		return;
	}

	const currentTypes = await readFile(outputPath, "utf8");
	const areTypesCurrent = currentTypes === generated;
	if (areTypesCurrent) {
		process.stdout.write(
			`Generated API types are current (${resourceCount} resources).\n`,
		);
		return;
	}

	process.exitCode = 1;
	process.stderr.write("Generated API types are stale.\n");
	process.stderr.write("Refresh with: pnpm generate:api-types\n");
};

export const main = async () => {
	const resources = await loadResources();
	const generated = renderTypes(resources);
	await writeOrCompare(generated, resources.length);
};

const stripTags = (html) => {
	const withoutTags = html.replace(/<[^>]+>/g, "");
	return decodeHtml(withoutTags);
};

const decodeHtml = (value) =>
	value
		.replace(/&quot;/g, '"')
		.replace(/&#34;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&#x27;/g, "'")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&nbsp;/g, " ")
		.replace(/\\u003c/g, "<")
		.replace(/\\u003e/g, ">");

const pascal = (value) => value.charAt(0).toUpperCase() + value.slice(1);

const camel = (value) =>
	value
		.split("-")
		.map((part, index) => {
			const isFirstPart = index === 0;
			return isFirstPart ? part : pascal(part);
		})
		.join("");

const singular = (value) => {
	const isPluralIes = value.endsWith("ies");
	if (isPluralIes) return `${value.slice(0, -3)}y`;
	const isPluralS = value.endsWith("s");
	if (isPluralS) return value.slice(0, -1);
	return value;
};

const resourceName = (resourceType) => {
	const singularType = singular(resourceType);
	return camel(singularType);
};

const resourceTypeFromUrl = (url) => {
	const parsed = new URL(url);
	const match = parsed.pathname.match(/^\/api\/([^/]+)\/the-[^/]+-object$/);
	return match?.[1];
};

export const discoverObjectPages = (html) => {
	const hrefs = [];
	const seen = new Set();
	const re = /href="([^"]*\/api\/[^"]+\/the-[^"]+-object)"/g;
	for (const match of html.matchAll(re)) {
		const raw = decodeHtml(match[1]);
		const isAbsoluteUrl = raw.startsWith("http");
		const url = isAbsoluteUrl ? raw : `${DOCS_ORIGIN}${raw}`;
		const resourceType = resourceTypeFromUrl(url);
		const isUnusableType = !resourceType || seen.has(resourceType);
		if (isUnusableType) continue;
		seen.add(resourceType);
		const name = resourceName(resourceType);
		hrefs.push({
			resourceType,
			resourceName: name,
			interfaceName: `Generated${pascal(name)}Attributes`,
			url,
		});
	}
	return hrefs;
};

const extractJsonCodeBlocks = (html) => {
	const re = /<code\b[^>]*data-language="json"[^>]*>([\s\S]*?)<\/code>/gi;
	const blocks = [];
	for (const match of html.matchAll(re)) {
		const blockText = stripTags(match[1]);
		blocks.push(blockText);
	}
	return blocks;
};

// Docs HTML sometimes ends with stray closing braces; trim them until the JSON parses.
const parseJson = (value) => {
	let candidate = value.trim();
	while (candidate.endsWith("}")) {
		try {
			return JSON.parse(candidate);
		} catch {
			candidate = candidate.slice(0, -1).trimEnd();
		}
	}
	return null;
};

export const extractResourceExample = (html, expectedType) => {
	const blocks = extractJsonCodeBlocks(html);
	for (const block of blocks) {
		const parsed = parseJson(block);
		const isResourceObject =
			parsed &&
			typeof parsed === "object" &&
			!Array.isArray(parsed) &&
			parsed.type === expectedType &&
			parsed.attributes &&
			typeof parsed.attributes === "object";
		if (isResourceObject) return parsed;
	}
	return null;
};

const isBooleanishKey = (key) => {
	const hasBooleanPrefix = /^(is|has|enabled|disabled|refunded|cancelled)/.test(
		key,
	);
	return hasBooleanPrefix || key === "test_mode";
};

const isStringOrNumberKey = (key) => /(^|_)(decimal|rate)(_|$)/.test(key);

const nullFallbackType = (key) => {
	if (isStringOrNumberKey(key)) return "string | number";
	const isNumberKey =
		/(^|_)(id|count|amount|price|fee|rate|total|tax|limit|quantity|mrr|sort)(_|$)/.test(
			key,
		);
	if (isNumberKey) return "number";
	const isDateKey = /(^|_)(date|at)(_|$)/.test(key);
	if (isDateKey) return "string";
	if (isBooleanishKey(key)) return "boolean";
	const isTextKey =
		/(^|_)(url|email|name|status|currency|country|region|city|interval|reason|brand)(_|$)/.test(
			key,
		);
	if (isTextKey) return "string";
	return "unknown";
};

const quoteProperty = (key) => {
	const isPlainIdentifier = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key);
	return isPlainIdentifier ? key : JSON.stringify(key);
};

const unique = (values) => {
	const distinctValues = new Set(values);
	return Array.from(distinctValues).sort();
};

const inferType = (value, key) => {
	const isNullValue = value === null;
	if (isNullValue) return `${nullFallbackType(key)} | null`;
	const isStringOrNumber = isStringOrNumberKey(key);
	const isStringValue = typeof value === "string";
	if (isStringValue && isStringOrNumber) return "string | number | null";
	if (isStringValue) return "string | null";
	const isNumberValue = typeof value === "number";
	if (isNumberValue && isStringOrNumber) return "string | number | null";
	if (isNumberValue && isBooleanishKey(key)) return "boolean | number | null";
	if (isNumberValue) return "number | null";
	const isBooleanValue = typeof value === "boolean";
	if (isBooleanValue) return "boolean | null";
	const isArrayValue = Array.isArray(value);
	if (isArrayValue) return inferArrayType(value, key);
	const isObjectValue = typeof value === "object";
	if (isObjectValue) return inferObjectType(value);
	return "unknown";
};

const inferArrayType = (values, key) => {
	const isUntypedArray = key === "tiers" || values.length === 0;
	if (isUntypedArray) return "unknown";
	const entryTypes = values.map((entry) => inferType(entry, key));
	const types = unique(entryTypes);
	return `Array<${types.join(" | ")}>`;
};

const inferObjectType = (value) => {
	const entries = Object.entries(value);
	const isObjectEmpty = entries.length === 0;
	if (isObjectEmpty) return "Record<string, unknown>";
	const body = entries
		.sort(([a], [b]) => a.localeCompare(b))
		.map(
			([key, nested]) => `${quoteProperty(key)}?: ${inferType(nested, key)};`,
		)
		.join(" ");
	return `{ ${body} } | null`;
};

const renderResourceInterface = (resource) => {
	const lines = [`export interface ${resource.interfaceName} {`];
	const entries = Object.entries(resource.attributes).sort(([a], [b]) =>
		a.localeCompare(b),
	);
	const isAttributeListEmpty = entries.length === 0;
	if (isAttributeListEmpty) {
		lines.push("  [key: string]: unknown;");
	} else {
		for (const [key, value] of entries) {
			lines.push(`  ${quoteProperty(key)}?: ${inferType(value, key)};`);
		}
	}
	lines.push("}", "");
	return lines;
};

export const renderTypes = (resources) => {
	const lines = [
		"/* eslint-disable */",
		"/**",
		" * AUTO-GENERATED by src/features/upkeep/generate-api-types.mjs.",
		" * Do not edit this file directly; run `pnpm generate:api-types`.",
		" *",
		` * Source index: ${INDEX_URL}`,
		" */",
		"",
		"export const GENERATED_LEMON_SQUEEZY_RESOURCES = [",
		...resources.map(
			(resource) => `  ${JSON.stringify(resource.resourceType)},`,
		),
		"] as const;",
		"",
		"export const GENERATED_LEMON_SQUEEZY_TYPE_SOURCE = {",
		...resources.map(
			(resource) =>
				`  ${resource.resourceName}: ${JSON.stringify(resource.url)},`,
		),
		"} as const;",
		"",
	];

	for (const resource of resources) {
		const interfaceLines = renderResourceInterface(resource);
		lines.push(...interfaceLines);
	}

	lines.push("export interface GeneratedLemonSqueezyFieldMap {");
	for (const resource of resources) {
		lines.push(`  ${resource.resourceName}: ${resource.interfaceName};`);
	}
	lines.push("}", "");
	lines.push(
		"export type GeneratedLemonSqueezyResourceName = keyof GeneratedLemonSqueezyFieldMap;",
	);
	lines.push(
		"export type GeneratedLemonSqueezyResourceType = (typeof GENERATED_LEMON_SQUEEZY_RESOURCES)[number];",
	);
	lines.push("");

	return `${lines.join("\n")}\n`;
};

runWhenInvokedDirectly(import.meta.url, main);
