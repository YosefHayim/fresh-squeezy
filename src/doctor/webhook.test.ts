import { makeHttp, pathIsWithQuery } from "@e2e/mock-fetch.js";
import {
	UNAUTHORIZED_ERROR,
	WEBHOOKS_COLLECTION_COMPLETE,
	WEBHOOKS_COLLECTION_EMPTY,
	WEBHOOKS_COLLECTION_MISSING_EVENTS,
	WEBHOOKS_COLLECTION_ORDER_EVENTS_ONLY,
} from "@e2e/sandbox-store.js";
import { describe, expect, test } from "vitest";
import { validateWebhook } from "./webhook.js";

const WEBHOOK_URL = "https://app.example.com/api/webhooks/lemon-squeezy";

const ALL_EVENTS = [
	"order_created",
	"order_refunded",
	"subscription_created",
	"subscription_updated",
	"subscription_cancelled",
	"subscription_resumed",
	"subscription_expired",
	"subscription_payment_success",
	"subscription_payment_failed",
	"customer_updated",
	"affiliate_activated",
	"license_key_created",
	"license_key_updated",
];

const createWebhooksDocument = (events: string[]) => ({
	data: [
		{
			type: "webhooks",
			id: "950",
			attributes: {
				store_id: 42,
				url: WEBHOOK_URL,
				events,
				last_sent_at: null,
			},
		},
	],
});

const validateAgainst = (
	storeWebhooks: unknown,
	url = WEBHOOK_URL,
	status = 200,
) => {
	const http = makeHttp([
		{
			accepts: pathIsWithQuery("/v1/webhooks", { "filter[store_id]": "42" }),
			status,
			replyDocument: storeWebhooks,
		},
	]);
	return validateWebhook(http, "test", { storeId: "42", url });
};

describe("validateWebhook", () => {
	test("passes when order and subscription events are subscribed", async () => {
		const webhookReport = await validateAgainst(WEBHOOKS_COLLECTION_COMPLETE);

		const errorFindings = webhookReport.findings.filter(
			(finding) => finding.severity === "error",
		);
		expect(webhookReport.ok).toBe(true);
		expect(errorFindings).toHaveLength(0);
		expect(webhookReport.target).toEqual({
			label: WEBHOOK_URL,
			id: "900",
			url: WEBHOOK_URL,
		});
	});

	test("raises no findings when every event is subscribed", async () => {
		const allEventsDocument = createWebhooksDocument(ALL_EVENTS);

		const webhookReport = await validateAgainst(allEventsDocument);

		expect(webhookReport.ok).toBe(true);
		expect(webhookReport.findings).toEqual([]);
	});

	test("shows missing optional events as info", async () => {
		const webhookReport = await validateAgainst(WEBHOOKS_COLLECTION_COMPLETE);

		const optionalFinding = webhookReport.findings.find(
			(finding) => finding.code === "WEBHOOK_OPTIONAL_EVENTS",
		);
		expect(optionalFinding?.severity).toBe("info");
		expect(optionalFinding?.message).toContain("affiliate_activated");
		expect(optionalFinding?.suggestedFix).toBeUndefined();
	});

	test("flags missing order events as errors", async () => {
		const webhookReport = await validateAgainst(
			WEBHOOKS_COLLECTION_MISSING_EVENTS,
		);

		const orderFinding = webhookReport.findings.find(
			(finding) => finding.code === "WEBHOOK_EVENTS_MISSING",
		);
		expect(webhookReport.ok).toBe(false);
		expect(orderFinding?.severity).toBe("error");
		expect(orderFinding?.context).toEqual({ missing: "order_refunded" });
	});

	test("warns without failing when only subscription events are missing", async () => {
		const webhookReport = await validateAgainst(
			WEBHOOKS_COLLECTION_ORDER_EVENTS_ONLY,
		);

		const subscriptionFinding = webhookReport.findings.find(
			(finding) => finding.code === "WEBHOOK_SUBSCRIPTION_EVENTS_MISSING",
		);
		expect(webhookReport.ok).toBe(true);
		expect(subscriptionFinding?.severity).toBe("warning");
		expect(subscriptionFinding?.context?.missing).toContain(
			"subscription_created",
		);
	});

	test("returns WEBHOOK_NOT_FOUND when the store has no matching webhook", async () => {
		const webhookReport = await validateAgainst(WEBHOOKS_COLLECTION_EMPTY);

		expect(webhookReport.ok).toBe(false);
		expect(webhookReport.findings[0]?.code).toBe("WEBHOOK_NOT_FOUND");
		expect(webhookReport.findings[0]?.context).toEqual({
			storeId: "42",
			url: WEBHOOK_URL,
		});
		expect(webhookReport.target).toEqual({
			label: WEBHOOK_URL,
			url: WEBHOOK_URL,
		});
	});

	test("reports AUTH_FAILED when the key is rejected", async () => {
		const webhookReport = await validateAgainst(
			UNAUTHORIZED_ERROR,
			WEBHOOK_URL,
			401,
		);

		expect(webhookReport.ok).toBe(false);
		expect(webhookReport.findings[0]?.code).toBe("AUTH_FAILED");
	});

	test("ignores trailing slashes when comparing URLs", async () => {
		const webhookReport = await validateAgainst(
			WEBHOOKS_COLLECTION_COMPLETE,
			`${WEBHOOK_URL}/`,
		);

		expect(webhookReport.ok).toBe(true);
	});

	test.each([
		["identical URLs", WEBHOOK_URL, true],
		["trailing slash", `${WEBHOOK_URL}/`, true],
		["multiple trailing slashes", `${WEBHOOK_URL}///`, true],
		[
			"different case",
			WEBHOOK_URL.toUpperCase().replace("/API/", "/api/"),
			true,
		],
		["different path", `${WEBHOOK_URL}-other`, false],
		["different host", WEBHOOK_URL.replace("app.", "other."), false],
	])("compares URLs: %s", async (_label, url, isSameUrl) => {
		const webhookReport = await validateAgainst(
			WEBHOOKS_COLLECTION_COMPLETE,
			url,
		);

		const isNotFound = webhookReport.findings[0]?.code === "WEBHOOK_NOT_FOUND";
		expect(isNotFound).toBe(!isSameUrl);
	});
});
