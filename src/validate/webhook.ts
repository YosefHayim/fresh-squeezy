import type { HttpClient } from "../core/http.js";
import type { Mode, ValidationIssue, ValidationResult } from "../core/types.js";
import type { WebhookAttributes } from "../resources/attributes.js";
import { OPTIONAL_WEBHOOK_EVENTS, RECOMMENDED_WEBHOOK_EVENTS } from "../support/manifest.js";
import { ISSUE_CODES, buildResult, issue } from "./issues.js";
import { probeCollection } from "./probe.js";

export interface WebhookValidationOptions {
  storeId: string | number;
  /** The public URL your app exposes for Lemon Squeezy to POST to. */
  url: string;
}

/**
 * Compare two webhook URLs ignoring trailing slashes and casing.
 *
 * Lemon Squeezy strips trailing slashes when persisting a webhook, but users
 * often paste the trailing-slash form into their config. `validateWebhook`
 * relies on this rule to match a configured URL against the registered list.
 */
export const sameWebhookUrl = (a: string, b: string): boolean => {
  return normalizeWebhookUrl(a) === normalizeWebhookUrl(b);
};

const normalizeWebhookUrl = (raw: string): string => {
  return raw.replace(/\/+$/, "").toLowerCase();
};

/**
 * Confirm a webhook matching `options.url` is registered against the given
 * store, and cross-reference its subscribed events against the support
 * manifest's recommended + optional lists.
 *
 * Missing recommended events = error. Missing optional events = info, because
 * not every integration needs them.
 */
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
  if (!fetched.ok) {
    return buildResult<WebhookAttributes>("webhook", mode, [fetched.issue], undefined, target);
  }

  const match = fetched.resource.find((webhook) =>
    sameWebhookUrl(webhook.attributes.url, options.url),
  );
  if (!match) {
    return buildResult<WebhookAttributes>(
      "webhook",
      mode,
      [
        issue(
          ISSUE_CODES.WEBHOOK_NOT_FOUND,
          "error",
          `No webhook registered for URL ${options.url} on store ${options.storeId}.`,
          {
            suggestedFix:
              "Register the webhook in Lemon Squeezy (Settings → Webhooks) and subscribe to the recommended events.",
            context: { storeId: String(options.storeId), url: options.url },
          },
        ),
      ],
      undefined,
      target,
    );
  }

  const issues: ValidationIssue[] = [];
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
          suggestedFix:
            "Subscribe to all recommended events so the integration survives plan changes and refunds.",
          context: { missing: missingRecommended.join(",") },
        },
      ),
    );
  }

  if (missingOptional.length > 0) {
    issues.push(
      issue(
        ISSUE_CODES.WEBHOOK_OPTIONAL_EVENTS,
        "info",
        `Optional events not subscribed: ${missingOptional.join(", ")}.`,
        { context: { missing: missingOptional.join(",") } },
      ),
    );
  }

  return buildResult("webhook", mode, issues, match.attributes, {
    label: match.attributes.url,
    id: match.id,
    url: match.attributes.url,
  });
};
