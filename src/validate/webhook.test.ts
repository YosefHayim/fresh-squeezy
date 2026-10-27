import { expect, test } from "vitest";
import {
	webhooksCollectionComplete,
	webhooksCollectionEmpty,
	webhooksCollectionMissingEvents,
} from "@e2e/fixtures/sandbox/data.js";
import { createMockFetch, pathIsWithQuery } from "@e2e/mock-fetch.js";
import { resolveConfig } from "@/shared/config.js";
import { HttpClient } from "@/http/http.js";
import { sameWebhookUrl, validateWebhook } from "./webhook.js";

const makeClient = (routes: Parameters<typeof createMockFetch>[0]) => {
	const { fetch } = createMockFetch(routes);
	return new HttpClient(resolveConfig({ apiKey: "k", fetch }));
};

const WEBHOOK_URL = "https://app.example.com/api/webhooks/lemon-squeezy";

test("validateWebhook passes when every recommended event is subscribed", async () => {
	const http = makeClient([
		{
			match: pathIsWithQuery("/v1/webhooks", { "filter[store_id]": "42" }),
			status: 200,
			body: webhooksCollectionComplete,
		},
	]);

	const webhookValidation = await validateWebhook(http, "test", {
		storeId: 42,
		url: WEBHOOK_URL,
	});

	expect(webhookValidation.ok).toBe(true);
	expect(
		webhookValidation.issues.filter((entry) => entry.severity === "error"),
	).toHaveLength(0);
});

test("validateWebhook flags missing recommended events as errors", async () => {
	const http = makeClient([
		{
			match: pathIsWithQuery("/v1/webhooks", { "filter[store_id]": "42" }),
			status: 200,
			body: webhooksCollectionMissingEvents,
		},
	]);

	const webhookValidation = await validateWebhook(http, "test", {
		storeId: 42,
		url: WEBHOOK_URL,
	});

	expect(webhookValidation.ok).toBe(false);
	expect(webhookValidation.issues.map((entry) => entry.code)).toContain(
		"WEBHOOK_EVENTS_MISSING",
	);
});

test("validateWebhook returns WEBHOOK_NOT_FOUND when the store has no matching webhook", async () => {
	const http = makeClient([
		{
			match: pathIsWithQuery("/v1/webhooks", { "filter[store_id]": "42" }),
			status: 200,
			body: webhooksCollectionEmpty,
		},
	]);

	const webhookValidation = await validateWebhook(http, "test", {
		storeId: 42,
		url: WEBHOOK_URL,
	});

	expect(webhookValidation.ok).toBe(false);
	expect(webhookValidation.issues[0]?.code).toBe("WEBHOOK_NOT_FOUND");
});

test("validateWebhook normalizes trailing slashes when matching URLs", async () => {
	const http = makeClient([
		{
			match: pathIsWithQuery("/v1/webhooks", { "filter[store_id]": "42" }),
			status: 200,
			body: webhooksCollectionComplete,
		},
	]);

	const webhookValidation = await validateWebhook(http, "test", {
		storeId: 42,
		url: `${WEBHOOK_URL}/`,
	});

	expect(webhookValidation.ok).toBe(true);
});

test("sameWebhookUrl matches identical URLs", () => {
	expect(
		sameWebhookUrl(
			"https://app.example.com/hooks",
			"https://app.example.com/hooks",
		),
	).toBe(true);
});

test("sameWebhookUrl ignores trailing slashes", () => {
	expect(
		sameWebhookUrl(
			"https://app.example.com/hooks/",
			"https://app.example.com/hooks",
		),
	).toBe(true);
	expect(
		sameWebhookUrl(
			"https://app.example.com/hooks",
			"https://app.example.com/hooks/",
		),
	).toBe(true);
});

test("sameWebhookUrl collapses multiple trailing slashes", () => {
	expect(
		sameWebhookUrl(
			"https://app.example.com/hooks///",
			"https://app.example.com/hooks",
		),
	).toBe(true);
});

test("sameWebhookUrl is case-insensitive", () => {
	expect(
		sameWebhookUrl(
			"HTTPS://APP.EXAMPLE.COM/hooks",
			"https://app.example.com/hooks",
		),
	).toBe(true);
});

test("sameWebhookUrl rejects different paths", () => {
	expect(
		sameWebhookUrl(
			"https://app.example.com/hooks",
			"https://app.example.com/other",
		),
	).toBe(false);
});

test("sameWebhookUrl rejects different hosts", () => {
	expect(
		sameWebhookUrl(
			"https://app.example.com/hooks",
			"https://other.example.com/hooks",
		),
	).toBe(false);
});
