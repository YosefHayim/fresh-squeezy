import type { Mode } from "@/client/environment.js";
import type { Http } from "@/client/http.js";
import type { WebhookAttributes } from "@/client/lemon-squeezy-types.js";
import { fetchCollection } from "./fetch-resource.js";
import {
	type CheckReport,
	createCheckReport,
	createFailedLookupReport,
	FINDING_CODES,
	type FindingRule,
	raiseFindings,
} from "./findings.js";

export interface WebhookCheck {
	storeId: string;
	url: string;
}

interface WebhookEventGaps {
	missingOrder: string[];
	missingSubscription: string[];
	missingOptional: string[];
}

const createComparableUrl = (url: string) =>
	url.replace(/\/+$/, "").toLowerCase();

const isSameUrl = (left: string, right: string) =>
	createComparableUrl(left) === createComparableUrl(right);

const findEventGaps = (webhook: WebhookAttributes): WebhookEventGaps => {
	const subscribed = new Set(webhook.events);
	const isUnsubscribed = (event: string) => !subscribed.has(event);
	return {
		missingOrder: ["order_created", "order_refunded"].filter(isUnsubscribed),
		missingSubscription: [
			"subscription_created",
			"subscription_updated",
			"subscription_cancelled",
			"subscription_resumed",
			"subscription_expired",
			"subscription_payment_success",
			"subscription_payment_failed",
		].filter(isUnsubscribed),
		missingOptional: [
			"customer_updated",
			"affiliate_activated",
			"license_key_created",
			"license_key_updated",
		].filter(isUnsubscribed),
	};
};

const isMissingOrder = ({ missingOrder }: WebhookEventGaps) =>
	missingOrder.length > 0;

const isMissingSubscription = ({ missingSubscription }: WebhookEventGaps) =>
	missingSubscription.length > 0;

const isMissingOptional = ({ missingOptional }: WebhookEventGaps) =>
	missingOptional.length > 0;

// A warning, not an error: a webhook may serve only one-time products, and the store does not say which.
const WEBHOOK_RULES: FindingRule<WebhookEventGaps>[] = [
	{
		code: FINDING_CODES.WEBHOOK_EVENTS_MISSING,
		severity: "error",
		when: isMissingOrder,
		message: ({ missingOrder }) =>
			`Webhook is missing order events: ${missingOrder.join(", ")}.`,
		suggestedFix:
			"Subscribe to order_created and order_refunded so every purchase and refund reaches your app.",
		details: ({ missingOrder }) => ({ missing: missingOrder.join(",") }),
	},
	{
		code: FINDING_CODES.WEBHOOK_SUBSCRIPTION_EVENTS_MISSING,
		severity: "warning",
		when: isMissingSubscription,
		message: ({ missingSubscription }) =>
			`Webhook is missing subscription events: ${missingSubscription.join(", ")}.`,
		suggestedFix:
			"If this endpoint handles subscriptions, subscribe to these events so plan changes and failed payments reach your app.",
		details: ({ missingSubscription }) => ({
			missing: missingSubscription.join(","),
		}),
	},
	{
		code: FINDING_CODES.WEBHOOK_OPTIONAL_EVENTS,
		severity: "info",
		when: isMissingOptional,
		message: ({ missingOptional }) =>
			`Optional events not subscribed: ${missingOptional.join(", ")}.`,
		details: ({ missingOptional }) => ({
			missing: missingOptional.join(","),
		}),
	},
];

export const validateWebhook = async (
	http: Http,
	mode: Mode,
	{ storeId, url }: WebhookCheck,
): Promise<CheckReport<WebhookAttributes>> => {
	const webhooksLookup = await fetchCollection<WebhookAttributes>(http, {
		path: "/v1/webhooks",
		query: { "filter[store_id]": storeId },
	});

	const webhookUrlTarget = { label: url, id: null, url };
	const isFetchFailed = webhooksLookup.kind === "failed";
	if (isFetchFailed) {
		return createFailedLookupReport({
			name: "webhook",
			mode,
			finding: webhooksLookup.finding,
			target: webhookUrlTarget,
		});
	}

	const webhook =
		webhooksLookup.resource.find((listedWebhook) =>
			isSameUrl(listedWebhook.attributes.url, url),
		) ?? null;
	const isWebhookMissing = webhook == null;
	if (isWebhookMissing) {
		return createCheckReport({
			name: "webhook",
			mode,
			findings: [
				{
					code: FINDING_CODES.WEBHOOK_NOT_FOUND,
					severity: "error",
					message: `No webhook registered for URL ${url} on store ${storeId}.`,
					suggestedFix:
						"Register the webhook in Lemon Squeezy (Settings → Webhooks) and subscribe to the order events, plus the subscription events if it handles subscriptions.",
					details: { storeId, url },
				},
			],
			resource: null,
			target: webhookUrlTarget,
		});
	}

	const eventGaps = findEventGaps(webhook.attributes);
	return createCheckReport({
		name: "webhook",
		mode,
		findings: raiseFindings(WEBHOOK_RULES, eventGaps),
		resource: webhook.attributes,
		target: {
			label: webhook.attributes.url,
			id: webhook.id,
			url: webhook.attributes.url,
		},
	});
};
