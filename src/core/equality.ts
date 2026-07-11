/**
 * Domain-equality primitives for fresh-squeezy.
 *
 * These helpers encode "when are two values the same in our domain?" — separate
 * from the validators that consume them so the rules are testable on their own
 * and reusable from any future surface (init, dedupe, repair, etc.).
 */

/**
 * Compare two webhook URLs ignoring trailing slashes and casing.
 *
 * Lemon Squeezy strips trailing slashes when persisting a webhook, but users
 * often paste the trailing-slash form into their config. The webhook validator
 * relies on this rule to match a configured URL against the registered list.
 */
export const sameWebhookUrl = (a: string, b: string): boolean => {
  return normalizeWebhookUrl(a) === normalizeWebhookUrl(b);
};

const normalizeWebhookUrl = (raw: string): string => {
  return raw.replace(/\/+$/, "").toLowerCase();
};
