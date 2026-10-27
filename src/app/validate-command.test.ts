import { storeDoc } from "@e2e/fixtures/sandbox/data.js";
import {
	pathIs,
	SIGNED_IN_ROUTES,
	silenceStdout,
	stubFetch,
} from "@e2e/mock-fetch.js";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ENV_KEYS } from "@/shared/config.js";
import { runValidateCommand } from "./validate-command.js";

beforeEach(() => {
	vi.stubEnv(ENV_KEYS.apiKey, "k_test_abc");
});

afterEach(() => {
	vi.restoreAllMocks();
});

test("runValidateCommand runs the connection validator and exits 0 on success", async () => {
	stubFetch([...SIGNED_IN_ROUTES]);
	silenceStdout();

	const code = await runValidateCommand("connection", {
		mode: "test",
		json: true,
		isInteractive: false,
	});
	expect(code).toBe(0);
});

test("runValidateCommand requires a store selection for the store validator in non-interactive mode", async () => {
	const stderr = vi
		.spyOn(process.stderr, "write")
		.mockImplementation(() => true);
	const code = await runValidateCommand("store", {
		mode: "test",
		isInteractive: false,
	});
	expect(code).toBe(2);
	const message = String(stderr.mock.calls[0]?.[0] ?? "");
	expect(message).toContain("Try:");
	expect(message).toContain("fresh-squeezy validate store --store-ids 12");
});

test("runValidateCommand runs the store validator per --store-ids entry", async () => {
	const { calls } = stubFetch([
		{ match: pathIs("/v1/stores/42"), status: 200, body: storeDoc },
		{
			match: pathIs("/v1/stores/43"),
			status: 200,
			body: { data: { ...storeDoc.data, id: "43" } },
		},
	]);
	const stdout = silenceStdout();

	const code = await runValidateCommand("store", {
		mode: "test",
		storeIds: ["42", "43"],
		json: true,
		isInteractive: false,
	});

	expect(code).toBe(0);
	expect(calls.filter((call) => call.url.includes("/v1/stores/"))).toHaveLength(
		2,
	);
	const payload = JSON.parse(String(stdout.mock.calls[0]?.[0] ?? "[]"));
	expect(payload).toHaveLength(2);
});

test("runValidateCommand resolves every reachable store when --all-stores is passed", async () => {
	stubFetch([
		...SIGNED_IN_ROUTES,
		{ match: pathIs("/v1/stores/42"), status: 200, body: storeDoc },
	]);
	silenceStdout();

	const code = await runValidateCommand("store", {
		mode: "test",
		allStores: true,
		json: true,
		isInteractive: false,
	});
	expect(code).toBe(0);
});
