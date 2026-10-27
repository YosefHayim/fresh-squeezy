import {
	webhooksCollectionComplete,
	webhooksCollectionEmpty,
	webhooksCollectionMissingEvents,
} from "@e2e/fixtures/sandbox/data.js";
import { makeClient, pathIsWithQuery } from "@e2e/mock-fetch.js";
import { expect, test } from "vitest";
import { validateWebhook } from "./webhook.js";

const WEBHOOK_URL = "https://app.example.com/api/webhooks/lemon-squeezy";

const validateAgainst = (storeWebhooks: unknown, url = WEBHOOK_URL) => {
	const http = makeClient([
		{
			match: pathIsWithQuery("/v1/webhooks", { "filter[store_id]": "42" }),
			status: 200,
			body: storeWebhooks,
		},
	]);
	return validateWebhook(http, "test", { storeId: 42, url });
};

test("validateWebhook passes when every recommended event is subscribed", async () => {
	const webhookValidation = await validateAgainst(webhooksCollectionComplete);

	expect(webhookValidation.ok).toBe(true);
	expect(
		webhookValidation.issues.filter((entry) => entry.severity === "error"),
	).toHaveLength(0);
});

test("validateWebhook flags missing recommended events as errors", async () => {
	const webhookValidation = await validateAgainst(
		webhooksCollectionMissingEvents,
	);

	expect(webhookValidation.ok).toBe(false);
	expect(webhookValidation.issues.map((entry) => entry.code)).toContain(
		"WEBHOOK_EVENTS_MISSING",
	);
});

test("validateWebhook returns WEBHOOK_NOT_FOUND when the store has no matching webhook", async () => {
	const webhookValidation = await validateAgainst(webhooksCollectionEmpty);

	expect(webhookValidation.ok).toBe(false);
	expect(webhookValidation.issues[0]?.code).toBe("WEBHOOK_NOT_FOUND");
});

test("validateWebhook normalizes trailing slashes when matching URLs", async () => {
	const webhookValidation = await validateAgainst(
		webhooksCollectionComplete,
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
		webhooksCollectionComplete,
		url,
	);

	const isNotFound = webhookValidation.issues[0]?.code === "WEBHOOK_NOT_FOUND";
	expect(isNotFound).toBe(!isMatch);
});
