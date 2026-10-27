#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const CHANGELOG_URL =
	"https://docs.lemonsqueezy.com/api/getting-started/changelog";

const thisFile = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(thisFile), "../..");
const snapshotPath = resolve(repoRoot, "src/support/changelog-snapshot.json");

const updateMode = process.argv.includes("--update");

export const DATE_RE =
	/\d{4}-\d{2}-\d{2}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4}/i;

const main = async () => {
	const html = await fetchText(CHANGELOG_URL);
	const normalized = normalize(html);
	const currentEntries = extractEntries(normalized);
	const hash = sha256(canonicalize(currentEntries));
	const fetchedAt = new Date().toISOString();

	if (updateMode || !existsSync(snapshotPath)) {
		await writeSnapshot({
			url: CHANGELOG_URL,
			fetchedAt,
			hash,
			entryCount: currentEntries.length,
			entries: currentEntries,
		});
		console.log(`Snapshot written: ${snapshotPath}`);
		console.log(`  url:        ${CHANGELOG_URL}`);
		console.log(`  hash:       ${hash}`);
		console.log(`  entries:    ${currentEntries.length}`);
		return;
	}

	const previous = JSON.parse(await readFile(snapshotPath, "utf8"));
	if (previous.hash === hash) {
		console.log(`No drift. Changelog unchanged since ${previous.fetchedAt}.`);
		console.log(`  ${currentEntries.length} entries match the snapshot.`);
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
	console.error(message);

	if (process.env.GITHUB_OUTPUT) {
		await appendGithubOutput("drifted", "true");
		await appendGithubOutput("previous_hash", previous.hash);
		await appendGithubOutput("current_hash", hash);
		await appendGithubOutput("previous_seen", previous.fetchedAt);
		await appendGithubOutput("current_seen", fetchedAt);
		if (formattedDiff) {
			const b64 = Buffer.from(formattedDiff, "utf8").toString("base64");
			await appendGithubOutput("diff_b64", b64);
		}
	}
};

async function fetchText(url) {
	const response = await fetch(url, {
		headers: {
			"user-agent":
				"fresh-squeezy-drift-check/0.1 (+https://github.com/YosefHayim/fresh-squeezy)",
			accept: "text/html,*/*",
		},
	});
	if (!response.ok) {
		throw new Error(`Fetch failed ${response.status} for ${url}`);
	}
	return response.text();
}

function normalize(html) {
	return isolateMain(html)
		.replace(/<script[\s\S]*?<\/script>/gi, "")
		.replace(/<style[\s\S]*?<\/style>/gi, "")
		.replace(/<!--[\s\S]*?-->/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

function isolateMain(html) {
	const match = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
	return match ? match[1] : html;
}

function sha256(value) {
	return createHash("sha256").update(value, "utf8").digest("hex");
}

async function writeSnapshot(snapshot) {
	await writeFile(
		snapshotPath,
		`${JSON.stringify(snapshot, null, 2)}\n`,
		"utf8",
	);
}

async function appendGithubOutput(key, value) {
	const line = `${key}=${String(value).replace(/\r?\n/g, "%0A")}\n`;
	const path = process.env.GITHUB_OUTPUT;
	if (!path) return;
	await writeFile(path, line, { flag: "a", encoding: "utf8" });
}

const stripTags = (html) => {
	return html
		.replace(/<[^>]+>/g, "")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&#x27;/g, "'")
		.replace(/&nbsp;/g, " ")
		.trim();
};

export function extractEntries(html) {
	if (!html) return [];

	const entries = [];
	// Raw row example: "heading"-like input should match.
	const headingRe = /<(h[1-6])[^>]*>(.*?)<\/\1>/gi;
	const headings = [];
	let m;
	// biome-ignore lint/suspicious/noAssignInExpressions: standard regex.exec() iteration idiom
	while ((m = headingRe.exec(html)) !== null) {
		const text = stripTags(m[2]);
		if (DATE_RE.test(text)) {
			headings.push({ index: m.index, end: m.index + m[0].length, text });
		}
	}

	for (let i = 0; i < headings.length; i++) {
		const bodyStart = headings[i].end;
		const bodyEnd =
			i + 1 < headings.length ? headings[i + 1].index : html.length;
		const excerpt = stripTags(html.slice(bodyStart, bodyEnd))
			.replace(/\s+/g, " ")
			.trim()
			.slice(0, 400);

		const dateMatch = headings[i].text.match(DATE_RE);
		const date = dateMatch ? dateMatch[0] : "unknown";
		entries.push({
			date,
			isoDate: toIsoDate(date),
			heading: headings[i].text.trim(),
			excerpt,
		});
	}

	// Sort newest-first so the snapshot is naturally readable: open the file
	// and the most recent entries are at the top of the array.
	return entries.sort((a, b) =>
		(b.isoDate ?? "").localeCompare(a.isoDate ?? ""),
	);
}

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

export function toIsoDate(raw) {
	if (!raw || raw === "unknown") return null;
	if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
	const m = raw.match(
		/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i,
	);
	if (!m) return null;
	const month = MONTHS[m[1].toLowerCase()];
	if (!month) return null;
	const day = m[2].padStart(2, "0");
	return `${m[3]}-${month}-${day}`;
}

function canonicalize(entries) {
	return JSON.stringify(
		entries.map((e) => ({ heading: e.heading, excerpt: e.excerpt })),
	);
}

function previousSnapshotEntries(previous) {
	if (Array.isArray(previous?.entries)) return previous.entries;
	if (typeof previous?.html === "string") return extractEntries(previous.html);
	return [];
}

export function diffEntries(previous, current) {
	const prevHeadings = new Set(previous.map((e) => e.heading));
	return current.filter((e) => !prevHeadings.has(e.heading));
}

function formatDiff(newEntries) {
	if (newEntries.length === 0) return "";
	return newEntries
		.map((e) => {
			const title = e.heading === e.date ? e.date : `${e.date}: ${e.heading}`;
			const block = [`### ${title}`];
			if (e.excerpt) {
				block.push("", e.excerpt + (e.excerpt.length >= 400 ? "…" : ""));
			}
			return block.join("\n");
		})
		.join("\n\n");
}

// Only run as a CLI when invoked directly (e.g. `node src/scripts/check-changelog.mjs`).
// Importing this module from a test or script should not trigger a network fetch.
const invokedAsCli =
	process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedAsCli) {
	main().catch((err) => {
		console.error(
			err instanceof Error ? (err.stack ?? err.message) : String(err),
		);
		process.exit(2);
	});
}
