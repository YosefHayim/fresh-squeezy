#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const CHANGELOG_URL =
	"https://docs.lemonsqueezy.com/api/getting-started/changelog";

const thisFile = fileURLToPath(import.meta.url);
const thisFolder = dirname(thisFile);
const repoRoot = resolve(thisFolder, "../..");
const snapshotPath = resolve(repoRoot, "src/support/changelog-snapshot.json");

const readFlagValue = (flagName) => {
	const flagIndex = process.argv.indexOf(flagName);
	const isFlagMissing = flagIndex === -1;
	if (isFlagMissing) return undefined;
	return process.argv[flagIndex + 1];
};

const updateMode = process.argv.includes("--update");
const githubOutputPath = readFlagValue("--github-output");

export const DATE_RE =
	/\d{4}-\d{2}-\d{2}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/i;

const main = async () => {
	const html = await fetchText(CHANGELOG_URL);
	const normalized = normalize(html);
	const currentEntries = extractEntries(normalized);
	const canonicalEntries = canonicalize(currentEntries);
	const hash = sha256(canonicalEntries);
	const fetchedAt = new Date().toISOString();

	const isSnapshotMissing = !existsSync(snapshotPath);
	const shouldWriteSnapshot = updateMode || isSnapshotMissing;
	if (shouldWriteSnapshot) {
		await writeSnapshot({
			url: CHANGELOG_URL,
			fetchedAt,
			hash,
			entryCount: currentEntries.length,
			entries: currentEntries,
		});
		process.stdout.write(`Snapshot written: ${snapshotPath}\n`);
		process.stdout.write(`  url:        ${CHANGELOG_URL}\n`);
		process.stdout.write(`  hash:       ${hash}\n`);
		process.stdout.write(`  entries:    ${currentEntries.length}\n`);
		return;
	}

	const snapshotText = await readFile(snapshotPath, "utf8");
	const previous = JSON.parse(snapshotText);
	const isChangelogUnchanged = previous.hash === hash;
	if (isChangelogUnchanged) {
		process.stdout.write(
			`No drift. Changelog unchanged since ${previous.fetchedAt}.\n`,
		);
		process.stdout.write(
			`  ${currentEntries.length} entries match the snapshot.\n`,
		);
		return;
	}

	// --- Drift detected ---
	process.exitCode = 1;

	const previousEntries = previousSnapshotEntries(previous);
	const newEntries = diffEntries(previousEntries, currentEntries);
	const formattedDiff = formatDiff(newEntries);

	const message = [
		`Drift detected in ${CHANGELOG_URL}.`,
		"",
		`Previous hash: ${previous.hash}`,
		`Previous seen: ${previous.fetchedAt}`,
		`Current hash:  ${hash}`,
		`Current seen:  ${fetchedAt}`,
		formattedDiff
			? `\n## New entries since last snapshot\n\n${formattedDiff}\n`
			: "",
		"Refresh the snapshot with:",
		"  pnpm check:changelog -- --update",
		"",
		"Then review the diff against src/support/manifest.ts and update",
		"RECOMMENDED_WEBHOOK_EVENTS / OPTIONAL_WEBHOOK_EVENTS /",
		"ACKNOWLEDGED_CHANGELOG_ENTRIES before committing.",
	]
		.filter(Boolean)
		.join("\n");
	process.stderr.write(`${message}\n`);

	const isGithubOutputNotRequested = !githubOutputPath;
	if (isGithubOutputNotRequested) return;

	await appendGithubOutput("drifted", "true");
	await appendGithubOutput("previous_hash", previous.hash);
	await appendGithubOutput("current_hash", hash);
	await appendGithubOutput("previous_seen", previous.fetchedAt);
	await appendGithubOutput("current_seen", fetchedAt);
	const isThereNoDiff = !formattedDiff;
	if (isThereNoDiff) return;
	const diffBytes = Buffer.from(formattedDiff, "utf8");
	const diffBase64 = diffBytes.toString("base64");
	await appendGithubOutput("diff_b64", diffBase64);
};

const fetchText = async (url) => {
	const response = await fetch(url, {
		headers: {
			"user-agent":
				"fresh-squeezy-drift-check/0.1 (+https://github.com/YosefHayim/fresh-squeezy)",
			accept: "text/html,*/*",
		},
	});
	const isResponseFailed = !response.ok;
	if (isResponseFailed) {
		throw new Error(`Fetch failed ${response.status} for ${url}`);
	}
	return response.text();
};

const normalize = (html) => {
	const mainHtml = isolateMain(html);
	return mainHtml
		.replace(/<script[\s\S]*?<\/script>/gi, "")
		.replace(/<style[\s\S]*?<\/style>/gi, "")
		.replace(/<!--[\s\S]*?-->/g, "")
		.replace(/\s+/g, " ")
		.trim();
};

const isolateMain = (html) => {
	const match = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
	return match ? match[1] : html;
};

const sha256 = (value) =>
	createHash("sha256").update(value, "utf8").digest("hex");

const writeSnapshot = async (snapshot) => {
	const snapshotJson = JSON.stringify(snapshot, null, 2);
	await writeFile(snapshotPath, `${snapshotJson}\n`, "utf8");
};

const appendGithubOutput = async (key, value) => {
	const singleLineValue = String(value).replace(/\r?\n/g, "%0A");
	const line = `${key}=${singleLineValue}\n`;
	await writeFile(githubOutputPath, line, { flag: "a", encoding: "utf8" });
};

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

	const entries = [];
	// Raw row example: "heading"-like input should match.
	const headingRe = /<(h[1-6])[^>]*>(.*?)<\/\1>/gi;
	const headings = [];
	for (const headingMatch of html.matchAll(headingRe)) {
		const text = stripTags(headingMatch[2]);
		const isUndatedHeading = !DATE_RE.test(text);
		if (isUndatedHeading) continue;
		const index = headingMatch.index;
		headings.push({ index, end: index + headingMatch[0].length, text });
	}

	for (const [headingPosition, heading] of headings.entries()) {
		const nextHeading = headings[headingPosition + 1];
		const bodyEnd = nextHeading ? nextHeading.index : html.length;
		const bodyHtml = html.slice(heading.end, bodyEnd);
		const excerpt = stripTags(bodyHtml)
			.replace(/\s+/g, " ")
			.trim()
			.slice(0, 400);

		const dateMatch = heading.text.match(DATE_RE);
		const date = dateMatch ? dateMatch[0] : "unknown";
		entries.push({
			date,
			isoDate: toIsoDate(date),
			heading: heading.text.trim(),
			excerpt,
		});
	}

	// Sort newest-first so the snapshot is naturally readable: open the file
	// and the most recent entries are at the top of the array.
	return entries.sort((a, b) =>
		(b.isoDate ?? "").localeCompare(a.isoDate ?? ""),
	);
};

const MONTHS = {
	january: "01",
	february: "02",
	march: "03",
	april: "04",
	may: "05",
	june: "06",
	july: "07",
	august: "08",
	september: "09",
	october: "10",
	november: "11",
	december: "12",
};

export const toIsoDate = (raw) => {
	const isDateMissing = !raw || raw === "unknown";
	if (isDateMissing) return null;
	const isAlreadyIso = /^\d{4}-\d{2}-\d{2}$/.test(raw);
	if (isAlreadyIso) return raw;
	const m = raw.match(
		/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i,
	);
	const isDateUnparseable = !m;
	if (isDateUnparseable) return null;
	const month = MONTHS[m[1].toLowerCase()];
	const isMonthUnknown = !month;
	if (isMonthUnknown) return null;
	const day = m[2].padStart(2, "0");
	return `${m[3]}-${month}-${day}`;
};

const canonicalize = (entries) => {
	const canonicalEntries = entries.map((e) => ({
		heading: e.heading,
		excerpt: e.excerpt,
	}));
	return JSON.stringify(canonicalEntries);
};

const previousSnapshotEntries = (previous) => {
	if (Array.isArray(previous?.entries)) return previous.entries;
	const hasLegacyHtml = typeof previous?.html === "string";
	if (hasLegacyHtml) return extractEntries(previous.html);
	return [];
};

export const diffEntries = (previous, current) => {
	const previousHeadingList = previous.map((e) => e.heading);
	const prevHeadings = new Set(previousHeadingList);
	return current.filter((e) => !prevHeadings.has(e.heading));
};

const formatEntry = (entry) => {
	const hasHeadingOnlyDate = entry.heading === entry.date;
	const title = hasHeadingOnlyDate
		? entry.date
		: `${entry.date}: ${entry.heading}`;
	const block = [`### ${title}`];
	const isExcerptMissing = !entry.excerpt;
	if (isExcerptMissing) return block.join("\n");
	const isExcerptTruncated = entry.excerpt.length >= 400;
	block.push("", entry.excerpt + (isExcerptTruncated ? "…" : ""));
	return block.join("\n");
};

const formatDiff = (newEntries) => {
	const hasNoNewEntries = newEntries.length === 0;
	if (hasNoNewEntries) return "";
	return newEntries.map(formatEntry).join("\n\n");
};

// Only run as a CLI when invoked directly (e.g. `node src/scripts/check-changelog.mjs`).
// Importing this module from a test or script should not trigger a network fetch.
const invokedAsCli =
	process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedAsCli) {
	main().catch((err) => {
		const isRealError = err instanceof Error;
		const errorText = isRealError ? (err.stack ?? err.message) : String(err);
		process.stderr.write(`${errorText}\n`);
		process.exit(2);
	});
}
