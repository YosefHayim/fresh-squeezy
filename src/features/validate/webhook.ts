import type { Mode } from "@/shared/config.js";
import type { Http } from "@/shared/http.js";
import type { WebhookAttributes } from "@/shared/lemon-squeezy-types.js";
import { fetchCollection } from "./fetch-resource.js";
import {
	buildResult,
	FINDING_CODES,
	type FindingRule,
	findingsFrom,
	type ValidationResult,
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

const ORDER_WEBHOOK_EVENTS = ["order_created", "order_refunded"] as const;

const SUBSCRIPTION_WEBHOOK_EVENTS = [
	"subscription_created",
	"subscription_updated",
	"subscription_cancelled",
	"subscription_resumed",
	"subscription_expired",
	"subscription_payment_success",
	"subscription_payment_failed",
] as const;

const OPTIONAL_WEBHOOK_EVENTS = [
	"customer_updated",
	"affiliate_activated",
	"license_key_created",
	"license_key_updated",
] as const;

const normalizedUrlOf = (url: string) => url.replace(/\/+$/, "").toLowerCase();

const isSameUrl = (left: string, right: string) =>
	normalizedUrlOf(left) === normalizedUrlOf(right);

const eventGapsOf = (webhook: WebhookAttributes): WebhookEventGaps => {
	const subscribed = new Set(webhook.events);
	const isUnsubscribed = (event: string) => !subscribed.has(event);
	return {
		missingOrder: ORDER_WEBHOOK_EVENTS.filter(isUnsubscribed),
		missingSubscription: SUBSCRIPTION_WEBHOOK_EVENTS.filter(isUnsubscribed),
		missingOptional: OPTIONAL_WEBHOOK_EVENTS.filter(isUnsubscribed),
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
		context: ({ missingOrder }) => ({ missing: missingOrder.join(",") }),
	},
	{
		code: FINDING_CODES.WEBHOOK_SUBSCRIPTION_EVENTS_MISSING,
		severity: "warning",
		when: isMissingSubscription,
		message: ({ missingSubscription }) =>
			`Webhook is missing subscription events: ${missingSubscription.join(", ")}.`,
		suggestedFix:
			"If this endpoint handles subscriptions, subscribe to these events so plan changes and failed payments reach your app.",
		context: ({ missingSubscription }) => ({
			missing: missingSubscription.join(","),
		}),
	},
	{
		code: FINDING_CODES.WEBHOOK_OPTIONAL_EVENTS,
		severity: "info",
		when: isMissingOptional,
		message: ({ missingOptional }) =>
			`Optional events not subscribed: ${missingOptional.join(", ")}.`,
		context: ({ missingOptional }) => ({ missing: missingOptional.join(",") }),
	},
];

export const validateWebhook = async (
	http: Http,
	mode: Mode,
	{ storeId, url }: WebhookCheck,
): Promise<ValidationResult<WebhookAttributes>> => {
	const fetched = await fetchCollection<WebhookAttributes>(http, {
		path: "/v1/webhooks",
		query: { "filter[store_id]": storeId },
	});
	const unregisteredTarget = { label: url, url };

	const isFetchFailed = fetched.kind === "failed";
	if (isFetchFailed) {
		return buildResult({
			name: "webhook",
			mode,
			findings: [fetched.finding],
			target: unregisteredTarget,
		});
	}

	const webhook = fetched.payload.find((entry) =>
		isSameUrl(entry.attributes.url, url),
	);
	const isWebhookMissing = webhook === undefined;
	if (isWebhookMissing) {
		return buildResult({
			name: "webhook",
			mode,
			findings: [
				{
					code: FINDING_CODES.WEBHOOK_NOT_FOUND,
					severity: "error",
					message: `No webhook registered for URL ${url} on store ${storeId}.`,
					suggestedFix:
						"Register the webhook in Lemon Squeezy (Settings → Webhooks) and subscribe to the order events, plus the subscription events if it handles subscriptions.",
					context: { storeId, url },
				},
			],
			target: unregisteredTarget,
		});
	}

	const eventGaps = eventGapsOf(webhook.attributes);
	return buildResult({
		name: "webhook",
		mode,
		findings: findingsFrom(WEBHOOK_RULES, eventGaps),
		resource: webhook.attributes,
		target: {
			label: webhook.attributes.url,
			id: webhook.id,
			url: webhook.attributes.url,
		},
	});
};
