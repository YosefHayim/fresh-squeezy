import {
	activeLicenseKeyDoc,
	publishedDiscountDoc,
	publishedProductDoc,
	storesCollection,
	subscriptionVariantDoc,
	unauthorizedError,
	userDoc,
	variantsCollectionPublished,
	webhooksCollectionComplete,
} from "@e2e/fixtures/sandbox/data.js";
import {
	okRoute,
	pathIs,
	SIGNED_IN_ROUTES,
	silenceStdout,
	storeListRoute,
	stubFetch,
	variantListRoute,
} from "@e2e/mock-fetch.js";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ENV_KEYS } from "@/shared/config.js";
import { runDoctorCommand } from "./doctor-command.js";

const runDoctorJson = async (
	options: Parameters<typeof runDoctorCommand>[0],
) => {
	const stdout = silenceStdout();
	const code = await runDoctorCommand({
		mode: "test",
		json: true,
		isInteractive: false,
		...options,
	});
	expect(code).toBe(0);
	return JSON.parse(String(stdout.mock.calls[0]?.[0] ?? "{}"));
};

beforeEach(() => {
	vi.stubEnv(ENV_KEYS.apiKey, "k_test_abc");
});

afterEach(() => {
	vi.restoreAllMocks();
});

test("runDoctorCommand returns exit code 0 when every validator passes for an explicit store id", async () => {
	stubFetch([
		...SIGNED_IN_ROUTES,
		okRoute(pathIs("/v1/stores/42"), { data: storesCollection.data[0] }),
		okRoute(pathIs("/v1/products/100"), publishedProductDoc),
		variantListRoute("100", variantsCollectionPublished),
	]);
	const payload = await runDoctorJson({
		storeIds: ["42"],
		productId: "100",
	});
	expect(payload.ok).toBe(true);
	expect(Array.isArray(payload.reports)).toBe(true);
	expect(payload.reports).toHaveLength(1);
	expect(payload.reports[0].results).toHaveLength(3);
});

test("runDoctorCommand runs against every reachable store when --all-stores is set", async () => {
	const multi = {
		data: [
			{ type: "stores", id: "42", attributes: { name: "A", slug: "a" } },
			{ type: "stores", id: "43", attributes: { name: "B", slug: "b" } },
		],
	};
	stubFetch([
		okRoute(pathIs("/v1/users/me"), userDoc),
		okRoute(pathIs("/v1/stores"), multi),
		okRoute(pathIs("/v1/stores/42"), { data: multi.data[0] }),
		okRoute(pathIs("/v1/stores/43"), { data: multi.data[1] }),
	]);
	const payload = await runDoctorJson({
		allStores: true,
	});
	expect(payload.reports).toHaveLength(2);
});

test("runDoctorCommand discovers and validates all resource targets when --all-resources is set", async () => {
	stubFetch([
		...SIGNED_IN_ROUTES,
		storeListRoute("products", {
			data: [publishedProductDoc.data],
		}),
		storeListRoute("webhooks", webhooksCollectionComplete),
		storeListRoute("discounts", {
			data: [publishedDiscountDoc.data],
		}),
		storeListRoute("license-keys", {
			data: [activeLicenseKeyDoc.data],
		}),
		variantListRoute("100", {
			data: [subscriptionVariantDoc.data],
		}),
		okRoute(pathIs("/v1/stores/42"), { data: storesCollection.data[0] }),
		okRoute(pathIs("/v1/products/100"), publishedProductDoc),
		okRoute(pathIs("/v1/discounts/600"), publishedDiscountDoc),
		okRoute(pathIs("/v1/license-keys/700"), activeLicenseKeyDoc),
		okRoute(pathIs("/v1/variants/800"), subscriptionVariantDoc),
	]);
	const payload = await runDoctorJson({
		storeIds: ["42"],
		allResources: true,
	});
	const names = payload.reports[0].results.map(
		(validation: { name: string }) => validation.name,
	);
	expect(names).toEqual([
		"connection",
		"store",
		"product",
		"webhook",
		"discount",
		"licenseKey",
		"subscriptionPlan",
	]);
});

test("runDoctorCommand falls back to connection-only when non-interactive and no store flag", async () => {
	stubFetch([...SIGNED_IN_ROUTES]);
	const payload = await runDoctorJson({});
	expect(payload.reports).toHaveLength(1);
	expect(payload.reports[0].results).toHaveLength(1);
	expect(payload.reports[0].results[0].name).toBe("connection");
});

test("runDoctorCommand returns exit code 1 when auth fails", async () => {
	stubFetch([
		{ match: pathIs("/v1/users/me"), status: 401, body: unauthorizedError },
	]);
	silenceStdout();
	vi.spyOn(process.stderr, "write").mockImplementation(() => true);

	const code = await runDoctorCommand({
		mode: "test",
		json: true,
		isInteractive: false,
	});
	expect(code).toBe(1);
});

test("runDoctorCommand returns exit code 2 when the API key is missing", async () => {
	vi.stubEnv(ENV_KEYS.apiKey, undefined);
	const stderr = vi
		.spyOn(process.stderr, "write")
		.mockImplementation(() => true);

	const code = await runDoctorCommand({ mode: "test", isInteractive: false });
	expect(code).toBe(2);
	const message = String(stderr.mock.calls[0]?.[0] ?? "");
	expect(message).toContain("fresh-squeezy init");
	expect(message).toContain(ENV_KEYS.apiKey);
});
