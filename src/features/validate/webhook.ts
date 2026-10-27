import type { WebhookAttributes } from "@/shared/attributes.js";
import type { Mode, ResourceId, ValidationResult } from "@/shared/contracts.js";
import type { HttpClient } from "@/shared/http.js";
import {
	OPTIONAL_WEBHOOK_EVENTS,
	RECOMMENDED_WEBHOOK_EVENTS,
} from "@/shared/support-manifest.js";
import {
	buildResult,
	failedResult,
	ISSUE_CODES,
	type IssueRule,
	issue,
	issuesOf,
} from "./issues.js";
import { probeCollection } from "./probe.js";

export interface WebhookValidationOptions {
	storeId: ResourceId;
	url: string;
}

const normalizeWebhookUrl = (raw: string): string => {
	return raw.replace(/\/+$/, "").toLowerCase();
};

const sameWebhookUrl = (a: string, b: string): boolean => {
	return normalizeWebhookUrl(a) === normalizeWebhookUrl(b);
};

interface WebhookEventGaps {
	missingRecommended: string[];
	missingOptional: string[];
}

const eventGapsOf = (attributes: WebhookAttributes): WebhookEventGaps => {
	const subscribed = new Set(attributes.events);
	const isUnsubscribed = (event: string) => !subscribed.has(event);
	return {
		missingRecommended: RECOMMENDED_WEBHOOK_EVENTS.filter(isUnsubscribed),
		missingOptional: OPTIONAL_WEBHOOK_EVENTS.filter(isUnsubscribed),
	};
};

const webhookIssueRules: IssueRule<WebhookEventGaps>[] = [
	{
		code: ISSUE_CODES.WEBHOOK_EVENTS_MISSING,
		severity: "error",
		isRaised: ({ missingRecommended }) => missingRecommended.length > 0,
		message: ({ missingRecommended }) =>
			`Webhook is missing recommended events: ${missingRecommended.join(", ")}.`,
		suggestedFix:
			"Subscribe to all recommended events so the integration survives plan changes and refunds.",
		context: ({ missingRecommended }) => ({
			missing: missingRecommended.join(","),
		}),
	},
	{
		code: ISSUE_CODES.WEBHOOK_OPTIONAL_EVENTS,
		severity: "info",
		isRaised: ({ missingOptional }) => missingOptional.length > 0,
		message: ({ missingOptional }) =>
			`Optional events not subscribed: ${missingOptional.join(", ")}.`,
		context: ({ missingOptional }) => ({ missing: missingOptional.join(",") }),
	},
];

export const validateWebhook = async (
	http: HttpClient,
	mode: Mode,
	options: WebhookValidationOptions,
): Promise<ValidationResult<WebhookAttributes>> => {
	const target = { label: options.url, url: options.url };

	const fetched = await probeCollection(() =>
		http.paginate<WebhookAttributes>("/v1/webhooks", {
			"filter[store_id]": String(options.storeId),
		}),
	);
	const isFetchFailed = !fetched.ok;
	if (isFetchFailed) {
		return failedResult("webhook", mode, fetched.issue, target);
	}

	const match = fetched.resource.find((webhook) =>
		sameWebhookUrl(webhook.attributes.url, options.url),
	);
	const isWebhookMissing = !match;
	if (isWebhookMissing) {
		const notFoundIssue = issue(
			ISSUE_CODES.WEBHOOK_NOT_FOUND,
			"error",
			`No webhook registered for URL ${options.url} on store ${options.storeId}.`,
			{
				suggestedFix:
					"Register the webhook in Lemon Squeezy (Settings → Webhooks) and subscribe to the recommended events.",
				context: { storeId: String(options.storeId), url: options.url },
			},
		);
		return failedResult("webhook", mode, notFoundIssue, target);
	}

	const eventGaps = eventGapsOf(match.attributes);
	const issues = issuesOf(webhookIssueRules, eventGaps);
	return buildResult("webhook", mode, issues, match.attributes, {
		label: match.attributes.url,
		id: match.id,
		url: match.attributes.url,
	});
};
