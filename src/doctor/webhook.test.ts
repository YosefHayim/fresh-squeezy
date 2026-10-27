import {
	WEBHOOKS_COLLECTION_COMPLETE,
	WEBHOOKS_COLLECTION_EMPTY,
	WEBHOOKS_COLLECTION_MISSING_EVENTS,
	WEBHOOKS_COLLECTION_ORDER_EVENTS_ONLY,
} from "@e2e/sandbox-store.js";
import { makeHttp, pathIsWithQuery } from "@e2e/mock-fetch.js";
import { expect, test } from "vitest";
import { validateWebhook } from "./webhook.js";

const WEBHOOK_URL = "https://app.example.com/api/webhooks/lemon-squeezy";

const validateAgainst = (storeWebhooks: unknown, url = WEBHOOK_URL) => {
	const http = makeHttp([
		{
			match: pathIsWithQuery("/v1/webhooks", { "filter[store_id]": "42" }),
			status: 200,
			body: storeWebhooks,
		},
	]);
	return validateWebhook(http, "test", { storeId: "42", url });
};

test("validateWebhook passes when order and subscription events are subscribed", async () => {
	const webhookValidation = await validateAgainst(WEBHOOKS_COLLECTION_COMPLETE);

	expect(webhookValidation.ok).toBe(true);
	expect(
		webhookValidation.findings.filter((entry) => entry.severity === "error"),
	).toHaveLength(0);
});

test("validateWebhook flags missing order events as errors", async () => {
	const webhookValidation = await validateAgainst(
		WEBHOOKS_COLLECTION_MISSING_EVENTS,
	);

	expect(webhookValidation.ok).toBe(false);
	expect(webhookValidation.findings.map((entry) => entry.code)).toContain(
		"WEBHOOK_EVENTS_MISSING",
	);
});

test("validateWebhook warns without failing when only subscription events are missing", async () => {
	const webhookValidation = await validateAgainst(
		WEBHOOKS_COLLECTION_ORDER_EVENTS_ONLY,
	);

	const subscriptionFinding = webhookValidation.findings.find(
		(entry) => entry.code === "WEBHOOK_SUBSCRIPTION_EVENTS_MISSING",
	);
	expect(webhookValidation.ok).toBe(true);
	expect(subscriptionFinding?.severity).toBe("warning");
});

test("validateWebhook returns WEBHOOK_NOT_FOUND when the store has no matching webhook", async () => {
	const webhookValidation = await validateAgainst(WEBHOOKS_COLLECTION_EMPTY);

	expect(webhookValidation.ok).toBe(false);
	expect(webhookValidation.findings[0]?.code).toBe("WEBHOOK_NOT_FOUND");
});

test("validateWebhook normalizes trailing slashes when matching URLs", async () => {
	const webhookValidation = await validateAgainst(
		WEBHOOKS_COLLECTION_COMPLETE,
		`${WEBHOOK_URL}/`,
	);

	expect(webhookValidation.ok).toBe(true);
});

test.each([
	["identical URLs", WEBHOOK_URL, true],
	["trailing slash", `${WEBHOOK_URL}/`, true],
	["multiple trailing slashes", `${WEBHOOK_URL}///`, true],
	["different case", WEBHOOK_URL.toUpperCase().replace("/API/", "/api/"), true],
	["different path", `${WEBHOOK_URL}-other`, false],
	["different host", WEBHOOK_URL.replace("app.", "other."), false],
])("validateWebhook url match: %s", async (_label, url, isMatch) => {
	const webhookValidation = await validateAgainst(
		WEBHOOKS_COLLECTION_COMPLETE,
		url,
	);

	const isNotFound =
		webhookValidation.findings[0]?.code === "WEBHOOK_NOT_FOUND";
	expect(isNotFound).toBe(!isMatch);
});
