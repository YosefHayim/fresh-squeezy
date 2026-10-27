#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { fetchText, runWhenInvokedDirectly } from "./script-support.mjs";

const CHANGELOG_URL =
	"https://docs.lemonsqueezy.com/api/getting-started/changelog";
const USER_AGENT =
	"fresh-squeezy-drift-check/0.1 (+https://github.com/YosefHayim/fresh-squeezy)";
const EXCERPT_LIMIT = 400;
const MONTH_NAMES = [
	"january",
	"february",
	"march",
	"april",
	"may",
	"june",
	"july",
	"august",
	"september",
	"october",
	"november",
	"december",
];
const MONTH_PATTERN = MONTH_NAMES.join("|");
const LONG_DATE_PATTERN = `(${MONTH_PATTERN})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})`;

const snapshotUrl = new URL("./changelog-snapshot.json", import.meta.url);
const snapshotPath = fileURLToPath(snapshotUrl);

const readFlagValue = (flagName) => {
	const flagIndex = process.argv.indexOf(flagName);
	const isFlagMissing = flagIndex === -1;
	if (isFlagMissing) return undefined;
	return process.argv[flagIndex + 1];
};

const updateMode = process.argv.includes("--update");
const githubOutputPath = readFlagValue("--github-output");

export const DATE_RE = new RegExp(
	`\\d{4}-\\d{2}-\\d{2}|${LONG_DATE_PATTERN}`,
	"i",
);
const LONG_DATE_RE = new RegExp(`^${LONG_DATE_PATTERN}$`, "i");

const writeSnapshotFile = async (snapshot) => {
	const snapshotJson = JSON.stringify(snapshot, null, "\t");
	await writeFile(snapshotPath, `${snapshotJson}\n`, "utf8");
	process.stdout.write(`Snapshot written: ${snapshotPath}\n`);
	process.stdout.write(`  url:        ${CHANGELOG_URL}\n`);
	process.stdout.write(`  hash:       ${snapshot.hash}\n`);
	process.stdout.write(`  entries:    ${snapshot.entryCount}\n`);
};

const driftMessage = (previous, current, formattedDiff) =>
	[
		`Drift detected in ${CHANGELOG_URL}.`,
		"",
		`Previous hash: ${previous.hash}`,
		`Previous seen: ${previous.fetchedAt}`,
		`Current hash:  ${current.hash}`,
		`Current seen:  ${current.fetchedAt}`,
		formattedDiff
			? `\n## New entries since last snapshot\n\n${formattedDiff}\n`
			: "",
		"Refresh the snapshot with:",
		"  pnpm check:changelog -- --update",
		"",
		"Then review the diff against src/shared/support-manifest.ts and update",
		"RECOMMENDED_WEBHOOK_EVENTS / OPTIONAL_WEBHOOK_EVENTS before committing.",
	]
		.filter(Boolean)
		.join("\n");

const publishDriftOutputs = async (previous, current, formattedDiff) => {
	const outputs = {
		drifted: "true",
		previous_hash: previous.hash,
		current_hash: current.hash,
		previous_seen: previous.fetchedAt,
		current_seen: current.fetchedAt,
	};
	const hasDiff = Boolean(formattedDiff);
	if (hasDiff) {
		outputs.diff_b64 = Buffer.from(formattedDiff, "utf8").toString("base64");
	}
	const outputLines = Object.entries(outputs).map(([key, value]) => {
		const singleLineValue = String(value).replace(/\r?\n/g, "%0A");
		return `${key}=${singleLineValue}\n`;
	});
	const outputText = outputLines.join("");
	await writeFile(githubOutputPath, outputText, {
		flag: "a",
		encoding: "utf8",
	});
};

const main = async () => {
	const html = await fetchText(CHANGELOG_URL, USER_AGENT);
	const normalizedHtml = normalize(html);
	const entries = extractEntries(normalizedHtml);
	const canonicalEntries = canonicalize(entries);
	const current = {
		url: CHANGELOG_URL,
		fetchedAt: new Date().toISOString(),
		hash: sha256(canonicalEntries),
		entryCount: entries.length,
		entries,
	};

	const isSnapshotMissing = !existsSync(snapshotPath);
	const shouldWriteSnapshot = updateMode || isSnapshotMissing;
	if (shouldWriteSnapshot) return writeSnapshotFile(current);

	const snapshotText = await readFile(snapshotPath, "utf8");
	const previous = JSON.parse(snapshotText);
	const isChangelogUnchanged = previous.hash === current.hash;
	if (isChangelogUnchanged) {
		process.stdout.write(
			`No drift. Changelog unchanged since ${previous.fetchedAt}.\n`,
		);
		process.stdout.write(`  ${entries.length} entries match the snapshot.\n`);
		return;
	}

	process.exitCode = 1;
	const newEntries = diffEntries(previous.entries ?? [], entries);
	const formattedDiff = formatDiff(newEntries);
	const message = driftMessage(previous, current, formattedDiff);
	process.stderr.write(`${message}\n`);

	const isGithubOutputRequested = Boolean(githubOutputPath);
	if (isGithubOutputRequested) {
		await publishDriftOutputs(previous, current, formattedDiff);
	}
};

const normalize = (html) => {
	const mainMatch = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
	const mainHtml = mainMatch ? mainMatch[1] : html;
	return mainHtml
		.replace(/<script[\s\S]*?<\/script>/gi, "")
		.replace(/<style[\s\S]*?<\/style>/gi, "")
		.replace(/<!--[\s\S]*?-->/g, "")
		.replace(/\s+/g, " ")
		.trim();
};

const sha256 = (value) =>
	createHash("sha256").update(value, "utf8").digest("hex");

const stripTags = (html) =>
	html
		.replace(/<[^>]+>/g, "")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&#x27;/g, "'")
		.replace(/&nbsp;/g, " ")
		.trim();

export const extractEntries = (html) => {
	const isHtmlEmpty = !html;
	if (isHtmlEmpty) return [];

	const headingRe = /<(h[1-6])[^>]*>(.*?)<\/\1>/gi;
	const headings = [];
	for (const headingMatch of html.matchAll(headingRe)) {
		const text = stripTags(headingMatch[2]);
		const isUndatedHeading = !DATE_RE.test(text);
		if (isUndatedHeading) continue;
		const index = headingMatch.index;
		headings.push({ index, end: index + headingMatch[0].length, text });
	}

	const entries = [];
	for (const [headingPosition, heading] of headings.entries()) {
		const nextHeading = headings[headingPosition + 1];
		const bodyEnd = nextHeading ? nextHeading.index : html.length;
		const bodyHtml = html.slice(heading.end, bodyEnd);
		const excerpt = stripTags(bodyHtml)
			.replace(/\s+/g, " ")
			.trim()
			.slice(0, EXCERPT_LIMIT);

		const dateMatch = heading.text.match(DATE_RE);
		const date = dateMatch ? dateMatch[0] : "unknown";
		entries.push({
			date,
			isoDate: toIsoDate(date),
			heading: heading.text.trim(),
			excerpt,
		});
	}

	// Newest first, so the top of the snapshot file is the latest entry.
	return entries.sort((entry, otherEntry) =>
		(otherEntry.isoDate ?? "").localeCompare(entry.isoDate ?? ""),
	);
};

export const toIsoDate = (raw) => {
	const isDateMissing = !raw || raw === "unknown";
	if (isDateMissing) return null;
	const isAlreadyIso = /^\d{4}-\d{2}-\d{2}$/.test(raw);
	if (isAlreadyIso) return raw;
	const longDateMatch = raw.match(LONG_DATE_RE);
	const isDateUnparseable = !longDateMatch;
	if (isDateUnparseable) return null;
	const [, monthName, day, year] = longDateMatch;
	const lowerMonthName = monthName.toLowerCase();
	const monthIndex = MONTH_NAMES.indexOf(lowerMonthName);
	const month = String(monthIndex + 1).padStart(2, "0");
	return `${year}-${month}-${day.padStart(2, "0")}`;
};

const canonicalize = (entries) => {
	const canonicalEntries = entries.map((entry) => ({
		heading: entry.heading,
		excerpt: entry.excerpt,
	}));
	return JSON.stringify(canonicalEntries);
};

export const diffEntries = (previous, current) => {
	const previousHeadingList = previous.map((entry) => entry.heading);
	const previousHeadings = new Set(previousHeadingList);
	return current.filter((entry) => !previousHeadings.has(entry.heading));
};

const formatEntry = (entry) => {
	const hasHeadingOnlyDate = entry.heading === entry.date;
	const title = hasHeadingOnlyDate
		? entry.date
		: `${entry.date}: ${entry.heading}`;
	const block = [`### ${title}`];
	const isExcerptMissing = !entry.excerpt;
	if (isExcerptMissing) return block.join("\n");
	const isExcerptTruncated = entry.excerpt.length >= EXCERPT_LIMIT;
	block.push("", entry.excerpt + (isExcerptTruncated ? "…" : ""));
	return block.join("\n");
};

const formatDiff = (newEntries) => newEntries.map(formatEntry).join("\n\n");

runWhenInvokedDirectly(import.meta.url, main);
