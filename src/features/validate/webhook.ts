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
	missingRecommended: string[];
	missingOptional: string[];
}

const RECOMMENDED_WEBHOOK_EVENTS = [
	"order_created",
	"order_refunded",
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
		missingRecommended: RECOMMENDED_WEBHOOK_EVENTS.filter(isUnsubscribed),
		missingOptional: OPTIONAL_WEBHOOK_EVENTS.filter(isUnsubscribed),
	};
};

const isMissingRecommended = ({ missingRecommended }: WebhookEventGaps) =>
	missingRecommended.length > 0;

const isMissingOptional = ({ missingOptional }: WebhookEventGaps) =>
	missingOptional.length > 0;

const WEBHOOK_RULES: FindingRule<WebhookEventGaps>[] = [
	{
		code: FINDING_CODES.WEBHOOK_EVENTS_MISSING,
		severity: "error",
		when: isMissingRecommended,
		message: ({ missingRecommended }) =>
			`Webhook is missing recommended events: ${missingRecommended.join(", ")}.`,
		suggestedFix:
			"Subscribe to all recommended events so the integration survives plan changes and refunds.",
		context: ({ missingRecommended }) => ({
			missing: missingRecommended.join(","),
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
						"Register the webhook in Lemon Squeezy (Settings → Webhooks) and subscribe to the recommended events.",
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
