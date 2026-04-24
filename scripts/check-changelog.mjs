#!/usr/bin/env node
/**
 * Drift check for the Lemon Squeezy API changelog.
 *
 * Why this exists: the docs page can change before our static
 * `src/support/manifest.ts` catches up. This script fetches the changelog,
 * normalizes obviously-volatile noise (scripts, styles, whitespace), hashes
 * the result, and compares against a snapshot committed to the repo.
 *
 * On drift, the script exits 1 and prints a summary; the weekly
 * `changelog-drift` workflow turns that into a GitHub issue so a maintainer
 * can review, update the manifest, and re-snapshot.
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

async function main() {
  const html = await fetchText(CHANGELOG_URL);
  const normalized = normalize(html);
  const hash = sha256(normalized);
  const fetchedAt = new Date().toISOString();

  if (updateMode || !existsSync(snapshotPath)) {
    await writeSnapshot({ url: CHANGELOG_URL, fetchedAt, hash });
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

  process.exitCode = 1;
  const message = [
    `Drift detected in ${CHANGELOG_URL}.`,
    ``,
    `Previous hash: ${previous.hash}`,
    `Previous seen: ${previous.fetchedAt}`,
    `Current hash:  ${hash}`,
    `Current seen:  ${fetchedAt}`,
    ``,
    `Refresh the snapshot with:`,
    `  npm run check:changelog -- --update`,
    ``,
    `Then review the diff against src/support/manifest.ts and update`,
    `RECOMMENDED_WEBHOOK_EVENTS / OPTIONAL_WEBHOOK_EVENTS /`,
    `ACKNOWLEDGED_CHANGELOG_ENTRIES before committing.`,
  ].join("\n");
  console.error(message);

  if (process.env.GITHUB_OUTPUT) {
    await appendGithubOutput("drifted", "true");
    await appendGithubOutput("previous_hash", previous.hash);
    await appendGithubOutput("current_hash", hash);
    await appendGithubOutput("previous_seen", previous.fetchedAt);
    await appendGithubOutput("current_seen", fetchedAt);
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

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(2);
});
