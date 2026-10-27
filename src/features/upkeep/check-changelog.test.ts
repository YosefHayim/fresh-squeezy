import { expect, test } from "vitest";
// @ts-expect-error — sibling .mjs import; no .d.ts is published for the script.
import {
	DATE_RE,
	diffEntries,
	extractEntries,
	toIsoDate,
} from "./check-changelog.mjs";

test.each([
	"2026-02-25",
	"February 25th, 2026",
	"January 1st, 2025",
	"March 2nd, 2024",
	"September 3rd, 2024",
	"June 11, 2025",
])("DATE_RE matches %s", (sample) => {
	expect(sample.match(DATE_RE)?.[0]).toBe(sample);
});

test("DATE_RE does not match unrelated text", () => {
	expect("not a date".match(DATE_RE)).toBeNull();
});

test("extractEntries extracts entries whose heading text contains an ordinal-suffix date", () => {
	const html = `
      <h2>February 25th, 2026</h2>
      <ul><li>We added a new property to the Order resource.</li></ul>
      <h2>January 21st, 2025</h2>
      <ul><li>New endpoints for license keys.</li></ul>
    `.replace(/\s+/g, " ");

	const entries = extractEntries(html);
	expect(entries).toHaveLength(2);
	expect(entries[0].date).toBe("February 25th, 2026");
	expect(entries[0].heading).toBe("February 25th, 2026");
	expect(entries[0].excerpt).toContain("Order resource");
	expect(entries[1].date).toBe("January 21st, 2025");
});

test("extractEntries attaches a sortable isoDate to each entry", () => {
	const html =
		"<h2>February 25th, 2026</h2><p>x</p><h2>January 21st, 2025</h2><p>y</p>";
	const [first, second] = extractEntries(html);
	expect(first.isoDate).toBe("2026-02-25");
	expect(second.isoDate).toBe("2025-01-21");
});

test("extractEntries sorts entries newest-first regardless of source order", () => {
	const html =
		"<h2>January 1st, 2024</h2><p>old</p><h2>February 25th, 2026</h2><p>new</p>";
	const [first, second] = extractEntries(html);
	expect(first.isoDate).toBe("2026-02-25");
	expect(second.isoDate).toBe("2024-01-01");
});

test("extractEntries ignores headings whose text does not contain a date", () => {
	const html =
		"<h3>Variants</h3><p>nav link</p><h2>February 25th, 2026</h2><p>real entry</p>";
	const entries = extractEntries(html);
	expect(entries).toHaveLength(1);
	expect(entries[0].heading).toBe("February 25th, 2026");
});

test.each([
	["2026-02-25", "2026-02-25"],
	["February 25th, 2026", "2026-02-25"],
	["January 1st, 2025", "2025-01-01"],
	["September 3rd, 2024", "2024-09-03"],
	["June 11, 2025", "2025-06-11"],
	["unknown", null],
	["not a date", null],
	["", null],
])("toIsoDate turns %j into %j", (raw, expected) => {
	expect(toIsoDate(raw)).toBe(expected);
});

test("diffEntries returns current entries that are absent from previous", () => {
	const prev = [
		{ date: "January 1st, 2025", heading: "January 1st, 2025", excerpt: "" },
	];
	const curr = [
		{ date: "January 1st, 2025", heading: "January 1st, 2025", excerpt: "" },
		{
			date: "February 25th, 2026",
			heading: "February 25th, 2026",
			excerpt: "",
		},
	];
	expect(diffEntries(prev, curr)).toEqual([
		{
			date: "February 25th, 2026",
			heading: "February 25th, 2026",
			excerpt: "",
		},
	]);
});

test("diffEntries returns [] when nothing changed", () => {
	const same = [
		{ date: "January 1st, 2025", heading: "January 1st, 2025", excerpt: "" },
	];
	expect(diffEntries(same, same)).toEqual([]);
});
