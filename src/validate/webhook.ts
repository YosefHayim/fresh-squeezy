import { FreshSqueezyError } from "../core/errors.js";
import type { HttpClient } from "../core/http.js";
import type { Mode, ValidationIssue, ValidationResult } from "../core/types.js";
import { listWebhooksForStore, type WebhookAttributes } from "../resources/webhooks.js";
import { OPTIONAL_WEBHOOK_EVENTS, RECOMMENDED_WEBHOOK_EVENTS } from "../support/manifest.js";
import { ISSUE_CODES, buildResult, issue } from "./rules.js";

export interface WebhookValidationOptions {
  storeId: string | number;
  /** The public URL your app exposes for Lemon Squeezy to POST to. */
  url: string;
}

/**
 * Confirm a webhook matching `options.url` is registered against the given
 * store, and cross-reference its subscribed events against the support
 * manifest's recommended + optional lists.
 *
 * Missing recommended events = error. Missing optional events = info, because
 * not every integration needs them.
 */
export async function validateWebhook(
  http: HttpClient,
  mode: Mode,
  options: WebhookValidationOptions
): Promise<ValidationResult<WebhookAttributes>> {
  const issues: ValidationIssue[] = [];

  let webhooks;
  try {
    webhooks = await listWebhooksForStore(http, options.storeId);
  } catch (err) {
    if (err instanceof FreshSqueezyError) {
      issues.push(
        issue(ISSUE_CODES.UNKNOWN, "error", err.message, {
          context: { status: err.status ?? null, code: err.code },
        })
      );
      return buildResult("webhook", mode, issues);
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    issues.push(issue(ISSUE_CODES.UNKNOWN, "error", message));
    return buildResult("webhook", mode, issues);
  }

  const match = webhooks.find((webhook) => normalizeUrl(webhook.attributes.url) === normalizeUrl(options.url));
  if (!match) {
    issues.push(
      issue(
        ISSUE_CODES.WEBHOOK_NOT_FOUND,
        "error",
        `No webhook registered for URL ${options.url} on store ${options.storeId}.`,
        {
          suggestedFix:
            "Register the webhook in Lemon Squeezy (Settings → Webhooks) and subscribe to the recommended events.",
          context: { storeId: String(options.storeId), url: options.url },
        }
      )
    );
    return buildResult("webhook", mode, issues);
  }

  const subscribed = new Set(match.attributes.events);
  const missingRecommended = RECOMMENDED_WEBHOOK_EVENTS.filter((event) => !subscribed.has(event));
  const missingOptional = OPTIONAL_WEBHOOK_EVENTS.filter((event) => !subscribed.has(event));

  if (missingRecommended.length > 0) {
    issues.push(
      issue(
        ISSUE_CODES.WEBHOOK_EVENTS_MISSING,
        "error",
        `Webhook is missing recommended events: ${missingRecommended.join(", ")}.`,
        {
          suggestedFix: "Subscribe to all recommended events so the integration survives plan changes and refunds.",
          context: { missing: missingRecommended.join(",") },
        }
      )
    );
  }

  if (missingOptional.length > 0) {
    issues.push(
      issue(
        ISSUE_CODES.WEBHOOK_OPTIONAL_EVENTS,
        "info",
        `Optional events not subscribed: ${missingOptional.join(", ")}.`,
        { context: { missing: missingOptional.join(",") } }
      )
    );
  }

  return buildResult("webhook", mode, issues, match.attributes);
}

/**
 * Compare webhook URLs without being tripped up by trailing slashes.
 * Lemon Squeezy strips trailing slashes on save; users often pass them in.
 */
function normalizeUrl(raw: string): string {
  return raw.replace(/\/+$/, "").toLowerCase();
}
