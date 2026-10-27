import type { HttpClient } from "@/http/http.js";
import type {
	Mode,
	ValidationIssue,
	ValidationResult,
} from "@/contracts/contracts.js";
import type { WebhookAttributes } from "@/resources/attributes.js";
import {
	OPTIONAL_WEBHOOK_EVENTS,
	RECOMMENDED_WEBHOOK_EVENTS,
} from "@/support/manifest.js";
import { ISSUE_CODES, buildResult, issue } from "./issues.js";
import { probeCollection } from "./probe.js";

export interface WebhookValidationOptions {
	storeId: string | number;
	url: string;
}

export const sameWebhookUrl = (a: string, b: string): boolean => {
	return normalizeWebhookUrl(a) === normalizeWebhookUrl(b);
};

const normalizeWebhookUrl = (raw: string): string => {
	return raw.replace(/\/+$/, "").toLowerCase();
};

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
		return buildResult<WebhookAttributes>(
			"webhook",
			mode,
			[fetched.issue],
			undefined,
			target,
		);
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
		return buildResult<WebhookAttributes>(
			"webhook",
			mode,
			[notFoundIssue],
			undefined,
			target,
		);
	}

	const issues: ValidationIssue[] = [];
	const subscribed = new Set(match.attributes.events);
	const missingRecommended = RECOMMENDED_WEBHOOK_EVENTS.filter(
		(event) => !subscribed.has(event),
	);
	const missingOptional = OPTIONAL_WEBHOOK_EVENTS.filter(
		(event) => !subscribed.has(event),
	);

	const isAnyRecommendedEventMissing = missingRecommended.length > 0;
	if (isAnyRecommendedEventMissing) {
		const missingEventsIssue = issue(
			ISSUE_CODES.WEBHOOK_EVENTS_MISSING,
			"error",
			`Webhook is missing recommended events: ${missingRecommended.join(", ")}.`,
			{
				suggestedFix:
					"Subscribe to all recommended events so the integration survives plan changes and refunds.",
				context: { missing: missingRecommended.join(",") },
			},
		);
		issues.push(missingEventsIssue);
	}

	const isAnyOptionalEventMissing = missingOptional.length > 0;
	if (isAnyOptionalEventMissing) {
		const optionalEventsIssue = issue(
			ISSUE_CODES.WEBHOOK_OPTIONAL_EVENTS,
			"info",
			`Optional events not subscribed: ${missingOptional.join(", ")}.`,
			{ context: { missing: missingOptional.join(",") } },
		);
		issues.push(optionalEventsIssue);
	}

	return buildResult("webhook", mode, issues, match.attributes, {
		label: match.attributes.url,
		id: match.id,
		url: match.attributes.url,
	});
};
