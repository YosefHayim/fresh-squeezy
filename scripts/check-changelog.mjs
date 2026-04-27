#!/usr/bin/env node
/**
 * Drift check for the Lemon Squeezy API changelog.
 *
 * Why this exists: the docs page can change before our static
 * `src/support/manifest.ts` catches up. This script fetches the changelog,
 * normalizes obviously-volatile noise (scripts, styles, whitespace), hashes
 * the result, and compares against a snapshot committed to the repo.
 *
 * On drift, the script exits 1 and prints a summary with a structured diff
 * of new entries; the weekly `changelog-drift` workflow turns that into a
 * GitHub issue so a maintainer can review, update the manifest, and
 * re-snapshot.
 *
 * Usage:
 *   node scripts/check-changelog.mjs            # check, exit 1 on drift
 *   node scripts/check-changelog.mjs --update   # refresh snapshot on disk
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const CHANGELOG_URL = "https://docs.lemonsqueezy.com/api/getting-started/changelog";

const thisFile = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(thisFile), "..");
const snapshotPath = resolve(repoRoot, "src/support/changelog-snapshot.json");

const updateMode = process.argv.includes("--update");

/** Date patterns commonly used in changelog headings. */
const DATE_RE = /\d{4}-\d{2}-\d{2}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i;

async function main() {
  const html = await fetchText(CHANGELOG_URL);
  const normalized = normalize(html);
  const hash = sha256(normalized);
  const fetchedAt = new Date().toISOString();

  if (updateMode || !existsSync(snapshotPath)) {
    await writeSnapshot({ url: CHANGELOG_URL, fetchedAt, hash, html: normalized });
    console.log(`Snapshot written: ${snapshotPath}`);
    console.log(`  url:  ${CHANGELOG_URL}`);
    console.log(`  hash: ${hash}`);
    return;
  }

  const previous = JSON.parse(await readFile(snapshotPath, "utf8"));
  if (previous.hash === hash) {
    console.log(`No drift. Changelog unchanged since ${previous.fetchedAt}.`);
    return;
  }

  // --- Drift detected ---
  process.exitCode = 1;

  const currentEntries = extractEntries(normalized);
  const previousEntries = extractEntries(previous.html || "");
  const newEntries = diffEntries(previousEntries, currentEntries);
  const formattedDiff = formatDiff(newEntries);

  const message = [
    `Drift detected in ${CHANGELOG_URL}.`,
    ``,
    `Previous hash: ${previous.hash}`,
    `Previous seen: ${previous.fetchedAt}`,
    `Current hash:  ${hash}`,
    `Current seen:  ${fetchedAt}`,
    formattedDiff ? `\n## New entries since last snapshot\n\n${formattedDiff}\n` : "",
    `Refresh the snapshot with:`,
    `  npm run check:changelog -- --update`,
    ``,
    `Then review the diff against src/support/manifest.ts and update`,
    `RECOMMENDED_WEBHOOK_EVENTS / OPTIONAL_WEBHOOK_EVENTS /`,
    `ACKNOWLEDGED_CHANGELOG_ENTRIES before committing.`,
  ].filter(Boolean).join("\n");
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
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "fresh-squeezy-drift-check/0.1 (+https://github.com/YosefHayim/fresh-squeezy)",
      accept: "text/html,*/*",
    },
  });
  if (!response.ok) {
    throw new Error(`Fetch failed ${response.status} for ${url}`);
  }
  return response.text();
}

/**
 * Strip volatile noise so the hash only changes when meaningful content
 * changes. We intentionally keep this conservative — a false positive costs
 * a human review, a false negative costs a silent miss.
 */
function normalize(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function writeSnapshot(snapshot) {
  await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}

async function appendGithubOutput(key, value) {
  const line = `${key}=${String(value).replace(/\r?\n/g, "%0A")}\n`;
  const path = process.env.GITHUB_OUTPUT;
  if (!path) return;
  await writeFile(path, line, { flag: "a", encoding: "utf8" });
}

/**
 * Remove HTML tags and decode common entities for plain-text excerpts.
 * Used only for the drift diff body, not for hashing.
 */
function stripTags(html) {
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
}

/**
 * Split normalized changelog HTML into structured entries by locating
 * heading elements whose text contains a date pattern. Each entry
 * includes the date, heading text, and a plain-text body excerpt.
 */
function extractEntries(html) {
  if (!html) return [];

  const entries = [];
  const headingRe = /<(h[1-6])[^>]*>(.*?)<\/\1>/gi;
  const headings = [];
  let m;
  while ((m = headingRe.exec(html)) !== null) {
    const text = stripTags(m[2]);
    if (DATE_RE.test(text)) {
      headings.push({ index: m.index, end: m.index + m[0].length, text });
    }
  }

  for (let i = 0; i < headings.length; i++) {
    const bodyStart = headings[i].end;
    const bodyEnd = i + 1 < headings.length ? headings[i + 1].index : html.length;
    const excerpt = stripTags(html.slice(bodyStart, bodyEnd)).replace(/\s+/g, " ").trim().slice(0, 400);

    const dateMatch = headings[i].text.match(DATE_RE);
    entries.push({
      date: dateMatch ? dateMatch[0] : "unknown",
      heading: headings[i].text.trim(),
      excerpt,
    });
  }

  return entries;
}

/**
 * Return entries present in `current` but absent from `previous`,
 * matched by heading text. Headings are unique enough for changelog
 * entries to avoid false negatives.
 */
function diffEntries(previous, current) {
  const prevHeadings = new Set(previous.map(e => e.heading));
  return current.filter(e => !prevHeadings.has(e.heading));
}

/**
 * Render a list of new changelog entries as markdown for both stdout
 * and the GitHub issue body.
 */
function formatDiff(newEntries) {
  if (newEntries.length === 0) return "";
  return newEntries.map(e => {
    const block = [`### ${e.date}: ${e.heading}`];
    if (e.excerpt) {
      block.push("", e.excerpt + (e.excerpt.length >= 400 ? "…" : ""));
    }
    return block.join("\n");
  }).join("\n\n");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(2);
});
