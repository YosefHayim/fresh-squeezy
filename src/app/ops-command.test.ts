import { pathIs, stubFetch } from "@e2e/mock-fetch.js";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

vi.mock("@inquirer/prompts", () => ({
	select: vi.fn(),
	checkbox: vi.fn(),
	password: vi.fn(),
	confirm: vi.fn(),
	input: vi.fn(),
}));

import { confirm } from "@inquirer/prompts";
import { runResourceOpCommand } from "./ops-command.js";

const discount = (id: string, code: string, name = `Name ${code}`) => ({
	type: "discounts",
	id,
	attributes: { store_id: 1, code, name },
});

const listBody = (items: unknown[], page = 1, lastPage = 1) => ({
	data: items,
	meta: { page: { currentPage: page, lastPage } },
});

let out = "";
let err = "";

beforeEach(() => {
	vi.stubEnv("LEMON_SQUEEZY_API_KEY", "test-key");
	vi.stubEnv("LEMON_SQUEEZY_MODE", "test");
	vi.stubEnv("LEMON_SQUEEZY_STORE_ID", undefined);
	out = "";
	err = "";
	vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
		out += String(chunk);
		return true;
	});
	vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
		err += String(chunk);
		return true;
	});
	vi.mocked(confirm).mockReset();
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

const emptyDelete = (id: string) => ({
	match: pathIs(`/v1/discounts/${id}`, "DELETE"),
	status: 200,
	body: {},
});

test("--all lists every page then deletes each item", async () => {
	const mock = stubFetch([
		{
			match: ({ method, url }) =>
				method === "GET" &&
				new URL(url).pathname === "/v1/discounts" &&
				new URL(url).searchParams.get("page[number]") === "1",
			status: 200,
			body: listBody([discount("1", "A")], 1, 2),
		},
		{
			match: ({ method, url }) =>
				method === "GET" &&
				new URL(url).pathname === "/v1/discounts" &&
				new URL(url).searchParams.get("page[number]") === "2",
			status: 200,
			body: listBody([discount("2", "B")], 2, 2),
		},
		emptyDelete("1"),
		emptyDelete("2"),
	]);

	const code = await runResourceOpCommand({
		verb: "delete",
		resource: "discount",
		storeIds: ["1"],
		all: true,
		yes: true,
		json: true,
	});

	expect(code).toBe(0);
	const deletes = mock.calls.filter((c) => c.method === "DELETE");
	expect(deletes.map((c) => new URL(c.url).pathname)).toEqual([
		"/v1/discounts/1",
		"/v1/discounts/2",
	]);
	const envelope = JSON.parse(out);
	expect(envelope).toMatchObject({
		ok: true,
		resource: "discount",
		verb: "delete",
		dryRun: false,
		total: 2,
		succeeded: 2,
		failed: 0,
	});
	expect(envelope.results.map((r: { label: string }) => r.label)).toEqual([
		"A",
		"B",
	]);
});

test("--dry-run sends no writes and needs no --yes", async () => {
	const mock = stubFetch([
		{
			match: pathIs("/v1/discounts"),
			status: 200,
			body: listBody([discount("1", "A"), discount("2", "B")]),
		},
	]);

	const code = await runResourceOpCommand({
		verb: "delete",
		resource: "discount",
		storeIds: ["1"],
		all: true,
		dryRun: true,
		json: true,
	});

	expect(code).toBe(0);
	expect(mock.calls.some((c) => c.method === "DELETE")).toBe(false);
	expect(JSON.parse(out)).toMatchObject({
		dryRun: true,
		total: 2,
		succeeded: 2,
	});
});

test("--ids skips list and deletes exactly those ids", async () => {
	const mock = stubFetch([emptyDelete("7"), emptyDelete("8")]);

	const code = await runResourceOpCommand({
		verb: "delete",
		resource: "discount",
		ids: ["7", "8"],
		yes: true,
		json: true,
	});

	expect(code).toBe(0);
	expect(
		mock.calls.map((c) => `${c.method} ${new URL(c.url).pathname}`),
	).toEqual(["DELETE /v1/discounts/7", "DELETE /v1/discounts/8"]);
});

test("--match keeps only items containing the text (case-insensitive)", async () => {
	const mock = stubFetch([
		{
			match: pathIs("/v1/discounts"),
			status: 200,
			body: listBody([
				discount("1", "KEEP"),
				discount("2", "NSAHTEST"),
				discount("3", "x"),
			]),
		},
		emptyDelete("2"),
	]);

	const code = await runResourceOpCommand({
		verb: "delete",
		resource: "discount",
		storeIds: ["1"],
		all: true,
		match: "nsah",
		yes: true,
		json: true,
	});

	expect(code).toBe(0);
	expect(mock.calls.filter((c) => c.method === "DELETE")).toHaveLength(1);
});

test("falls back to LEMON_SQUEEZY_STORE_ID for --all scope", async () => {
	vi.stubEnv("LEMON_SQUEEZY_STORE_ID", "42");
	const mock = stubFetch([
		{ match: pathIs("/v1/discounts"), status: 200, body: listBody([]) },
	]);

	const code = await runResourceOpCommand({
		verb: "delete",
		resource: "discount",
		all: true,
		yes: true,
		json: true,
	});

	expect(code).toBe(0);
	expect(new URL(mock.calls[0].url).searchParams.get("filter[store_id]")).toBe(
		"42",
	);
	expect(JSON.parse(out)).toMatchObject({ total: 0, ok: true });
});

test("returns 1 and reports per-item errors on partial failure", async () => {
	stubFetch([
		{
			match: pathIs("/v1/discounts"),
			status: 200,
			body: listBody([discount("1", "A"), discount("2", "B")]),
		},
		emptyDelete("1"),
		{
			match: pathIs("/v1/discounts/2", "DELETE"),
			status: 404,
			body: {
				errors: [
					{
						status: "404",
						code: "not_found",
						title: "Not found",
						detail: "gone",
					},
				],
			},
		},
	]);

	const code = await runResourceOpCommand({
		verb: "delete",
		resource: "discount",
		storeIds: ["1"],
		all: true,
		yes: true,
		json: true,
	});

	expect(code).toBe(1);
	const envelope = JSON.parse(out);
	expect(envelope).toMatchObject({ ok: false, succeeded: 1, failed: 1 });
	expect(envelope.results[1]).toMatchObject({ id: "2", ok: false });
	expect(envelope.results[1].error).toBeTruthy();
});

test("refuses non-interactive bulk without --yes and sends nothing", async () => {
	const mock = stubFetch([
		{
			match: pathIs("/v1/discounts"),
			status: 200,
			body: listBody([discount("1", "A")]),
		},
	]);

	const code = await runResourceOpCommand({
		verb: "delete",
		resource: "discount",
		storeIds: ["1"],
		all: true,
		isInteractive: false,
	});

	expect(code).toBe(2);
	expect(err).toContain("requires --yes");
	expect(err).toContain("--all");
	expect(mock.calls.some((c) => c.method === "DELETE")).toBe(false);
});

test("asks once with count and labels when interactive, and honors a No", async () => {
	const mock = stubFetch([
		{
			match: pathIs("/v1/discounts"),
			status: 200,
			body: listBody([discount("1", "AAA"), discount("2", "BBB")]),
		},
	]);
	vi.mocked(confirm).mockResolvedValueOnce(false);

	const code = await runResourceOpCommand({
		verb: "delete",
		resource: "discount",
		storeIds: ["1"],
		all: true,
		isInteractive: true,
	});

	expect(code).toBe(2);
	expect(confirm).toHaveBeenCalledTimes(1);
	const message = vi.mocked(confirm).mock.calls[0][0].message;
	expect(message).toContain("2 discount");
	expect(message).toContain("AAA, BBB");
	expect(mock.calls.some((c) => c.method === "DELETE")).toBe(false);
});

test("errors when --all has no store scope", async () => {
	stubFetch([]);
	const code = await runResourceOpCommand({
		verb: "delete",
		resource: "discount",
		all: true,
		yes: true,
		json: true,
	});
	expect(code).toBe(2);
	expect(err).toContain("MISSING_ARG");
});

test.each([
	["--all with --ids", { all: true, ids: ["1"] }, "either --all or --ids"],
	["--all with --id", { all: true, id: "1" }, "--id targets one resource"],
	["--match without --all", { ids: ["1"], match: "x" }, "--match needs --all"],
	["--dry-run without bulk", { dryRun: true }, "--dry-run needs"],
])("rejects %s", async (_name, flags, message) => {
	stubFetch([]);
	const code = await runResourceOpCommand({
		verb: "delete",
		resource: "discount",
		storeIds: ["1"],
		yes: true,
		json: true,
		...flags,
	});
	expect(code).toBe(2);
	expect(err).toContain(message);
});

test("rejects --all on verbs that are not delete/cancel/refund", async () => {
	stubFetch([]);
	const code = await runResourceOpCommand({
		verb: "list",
		resource: "discount",
		storeIds: ["1"],
		all: true,
		json: true,
	});
	expect(code).toBe(2);
	expect(err).toContain("only apply to delete, cancel, and refund");
});
