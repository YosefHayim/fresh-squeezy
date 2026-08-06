#!/usr/bin/env node
/**
 * Generate a docs-derived Lemon Squeezy API type map.
 *
 * The changelog tells us *that* something changed, but the object docs are the
 * most useful structured source for *what fields exist now*. This script:
 *
 *   1. Discovers every `/api/.../the-...-object` page from the docs nav.
 *   2. Extracts the JSON resource example from each page.
 *   3. Infers a broad, optional TypeScript attributes interface.
 *   4. Writes `src/generated/lemonSqueezyApiTypes.ts`.
 *
 * Usage:
 *   node src/scripts/generate-api-types.mjs            # check generated file
 *   node src/scripts/generate-api-types.mjs --update   # refresh generated file
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DOCS_ORIGIN = "https://docs.lemonsqueezy.com";
const INDEX_URL = `${DOCS_ORIGIN}/api/getting-started/requests`;

const thisFile = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(thisFile), "../..");
const outputPath = resolve(repoRoot, "src/generated/lemonSqueezyApiTypes.ts");
const updateMode = process.argv.includes("--update");

const RESOURCE_NAME_OVERRIDES = {
  users: "user",
  stores: "store",
  customers: "customer",
  products: "product",
  variants: "variant",
  prices: "price",
  files: "file",
  orders: "order",
  "order-items": "orderItem",
  subscriptions: "subscription",
  "subscription-invoices": "subscriptionInvoice",
  "subscription-items": "subscriptionItem",
  "usage-records": "usageRecord",
  discounts: "discount",
  "discount-redemptions": "discountRedemption",
  "license-keys": "licenseKey",
  "license-key-instances": "licenseKeyInstance",
  checkouts: "checkout",
  webhooks: "webhook",
  affiliates: "affiliate",
};

export async function main() {
  const indexHtml = await fetchText(INDEX_URL);
  const pages = discoverObjectPages(indexHtml);
  const resources = [];

  for (const page of pages) {
    const html = await fetchText(page.url);
    const example = extractResourceExample(html, page.resourceType);
    if (!example) continue;
    resources.push({
      ...page,
      attributes: example.attributes ?? {},
    });
  }

  if (resources.length === 0) {
    throw new Error("No resource examples were discovered from Lemon Squeezy docs.");
  }

  const generated = renderTypes(resources);

  if (updateMode || !existsSync(outputPath)) {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, generated, "utf8");
    console.log(`Generated ${outputPath}`);
    console.log(`  resources: ${resources.length}`);
    return;
  }

  const current = await readFile(outputPath, "utf8");
  if (current === generated) {
    console.log(`Generated API types are current (${resources.length} resources).`);
    return;
  }

  process.exitCode = 1;
  console.error("Generated API types are stale.");
  console.error("Refresh with: pnpm generate:api-types");
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "fresh-squeezy-api-type-generator/0.1 (+https://github.com/YosefHayim/fresh-squeezy)",
      accept: "text/html,*/*",
    },
  });
  if (!response.ok) throw new Error(`Fetch failed ${response.status} for ${url}`);
  return response.text();
}

export function discoverObjectPages(html) {
  const hrefs = [];
  const seen = new Set();
  const re = /href="([^"]*\/api\/[^"]+\/the-[^"]+-object)"/g;
  let match;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex.exec() iteration idiom
  while ((match = re.exec(html)) !== null) {
    const raw = decodeHtml(match[1]);
    const url = raw.startsWith("http") ? raw : `${DOCS_ORIGIN}${raw}`;
    const resourceType = resourceTypeFromUrl(url);
    if (!resourceType || seen.has(resourceType)) continue;
    seen.add(resourceType);
    hrefs.push({
      resourceType,
      resourceName: resourceName(resourceType),
      interfaceName: `Generated${pascal(resourceName(resourceType))}Attributes`,
      url,
    });
  }
  return hrefs;
}

function resourceTypeFromUrl(url) {
  const parsed = new URL(url);
  const match = parsed.pathname.match(/^\/api\/([^/]+)\/the-[^/]+-object$/);
  return match?.[1];
}

export function extractResourceExample(html, expectedType) {
  const blocks = extractJsonCodeBlocks(html);
  for (const block of blocks) {
    const parsed = parseJson(block);
    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      parsed.type === expectedType &&
      parsed.attributes &&
      typeof parsed.attributes === "object"
    ) {
      return parsed;
    }
  }
  return null;
}

function extractJsonCodeBlocks(html) {
  const blocks = [];
  const re = /<code\b[^>]*data-language="json"[^>]*>([\s\S]*?)<\/code>/gi;
  let match;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex.exec() iteration idiom
  while ((match = re.exec(html)) !== null) {
    blocks.push(stripTags(match[1]));
  }
  return blocks;
}

function stripTags(html) {
  return decodeHtml(html.replace(/<[^>]+>/g, ""));
}

function parseJson(value) {
  const normalized = trimExtraClosingBraces(value);
  try {
    return JSON.parse(normalized);
  } catch {
    return null;
  }
}

function trimExtraClosingBraces(value) {
  let normalized = value.trim();
  while (braceBalance(normalized) < 0 && normalized.endsWith("}")) {
    normalized = normalized.slice(0, -1).trimEnd();
  }
  return normalized;
}

function braceBalance(value) {
  let balance = 0;
  let inString = false;
  let escaped = false;
  for (const char of value) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") balance += 1;
    if (char === "}") balance -= 1;
  }
  return balance;
}

function renderTypes(resources) {
  const lines = [
    "/* eslint-disable */",
    "/**",
    " * AUTO-GENERATED by scripts/generate-api-types.mjs.",
    " * Do not edit this file directly; run `npm run generate:api-types`.",
    " *",
    ` * Source index: ${INDEX_URL}`,
    " */",
    "",
    "export const GENERATED_LEMON_SQUEEZY_RESOURCES = [",
    ...resources.map((resource) => `  ${JSON.stringify(resource.resourceType)},`),
    "] as const;",
    "",
    "export const GENERATED_LEMON_SQUEEZY_TYPE_SOURCE = {",
    ...resources.map((resource) => `  ${resource.resourceName}: ${JSON.stringify(resource.url)},`),
    "} as const;",
    "",
  ];

  for (const resource of resources) {
    lines.push(`export interface ${resource.interfaceName} {`);
    const entries = Object.entries(resource.attributes).sort(([a], [b]) => a.localeCompare(b));
    if (entries.length === 0) {
      lines.push("  [key: string]: unknown;");
    } else {
      for (const [key, value] of entries) {
        lines.push(`  ${quoteProperty(key)}?: ${inferType(value, key)};`);
      }
    }
    lines.push("}", "");
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
}

function inferType(value, key) {
  if (value === null) return `${nullFallbackType(key)} | null`;
  if (typeof value === "string") {
    return isStringOrNumberKey(key) ? "string | number | null" : "string | null";
  }
  if (typeof value === "number") {
    if (isStringOrNumberKey(key)) return "string | number | null";
    return isBooleanishKey(key) ? "boolean | number | null" : "number | null";
  }
  if (typeof value === "boolean") return "boolean | null";
  if (Array.isArray(value)) return inferArrayType(value, key);
  if (typeof value === "object") return inferObjectType(value);
  return "unknown";
}

function inferArrayType(values, key) {
  if (key === "tiers") return "unknown";
  if (values.length === 0) return "unknown";
  const types = unique(values.map((entry) => inferType(entry, key)));
  return `Array<${types.join(" | ")}>`;
}

function inferObjectType(value) {
  const entries = Object.entries(value);
  if (entries.length === 0) return "Record<string, unknown>";
  const body = entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, nested]) => `${quoteProperty(key)}?: ${inferType(nested, key)};`)
    .join(" ");
  return `{ ${body} } | null`;
}

function nullFallbackType(key) {
  if (isStringOrNumberKey(key)) return "string | number";
  if (/(^|_)(id|count|amount|price|fee|rate|total|tax|limit|quantity|mrr|sort)(_|$)/.test(key)) {
    return "number";
  }
  if (/(^|_)(date|at)(_|$)/.test(key)) return "string";
  if (isBooleanishKey(key)) return "boolean";
  if (
    /(^|_)(url|email|name|status|currency|country|region|city|interval|reason|brand|date|at)(_|$)/.test(
      key,
    )
  ) {
    return "string";
  }
  return "unknown";
}

function isBooleanishKey(key) {
  return /^(is|has|enabled|disabled|refunded|cancelled)/.test(key) || key === "test_mode";
}

function isStringOrNumberKey(key) {
  return /(^|_)(decimal|rate)(_|$)/.test(key);
}

function resourceName(resourceType) {
  return RESOURCE_NAME_OVERRIDES[resourceType] ?? camel(singular(resourceType));
}

function singular(value) {
  if (value.endsWith("ies")) return `${value.slice(0, -3)}y`;
  if (value.endsWith("s")) return value.slice(0, -1);
  return value;
}

function pascal(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function camel(value) {
  return value
    .split("-")
    .map((part, index) => (index === 0 ? part : pascal(part)))
    .join("");
}

function quoteProperty(key) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}

function unique(values) {
  return Array.from(new Set(values)).sort();
}

function decodeHtml(value) {
  return value
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
}

const invokedAsCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedAsCli) {
  main().catch((err) => {
    console.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
    process.exit(2);
  });
}
