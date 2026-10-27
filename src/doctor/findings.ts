import type { Mode } from "@/client/environment.js";

export const FINDING_CODES = {
	AUTH_FAILED: "AUTH_FAILED",
	MODE_MISMATCH: "MODE_MISMATCH",
	NETWORK_ERROR: "NETWORK_ERROR",
	UNKNOWN: "UNKNOWN",
	STORE_NOT_FOUND: "STORE_NOT_FOUND",
	PRODUCT_NOT_FOUND: "PRODUCT_NOT_FOUND",
	PRODUCT_WRONG_STORE: "PRODUCT_WRONG_STORE",
	PRODUCT_UNPUBLISHED: "PRODUCT_UNPUBLISHED",
	PRODUCT_NO_BUY_URL: "PRODUCT_NO_BUY_URL",
	VARIANT_UNPUBLISHED: "VARIANT_UNPUBLISHED",
	VARIANT_MISSING: "VARIANT_MISSING",
	WEBHOOK_NOT_FOUND: "WEBHOOK_NOT_FOUND",
	WEBHOOK_EVENTS_MISSING: "WEBHOOK_EVENTS_MISSING",
	WEBHOOK_SUBSCRIPTION_EVENTS_MISSING: "WEBHOOK_SUBSCRIPTION_EVENTS_MISSING",
	WEBHOOK_OPTIONAL_EVENTS: "WEBHOOK_OPTIONAL_EVENTS",
	DISCOUNT_NOT_FOUND: "DISCOUNT_NOT_FOUND",
	DISCOUNT_DRAFT: "DISCOUNT_DRAFT",
	DISCOUNT_EXPIRED: "DISCOUNT_EXPIRED",
	DISCOUNT_NOT_STARTED: "DISCOUNT_NOT_STARTED",
	DISCOUNT_REDEMPTIONS_EXHAUSTED: "DISCOUNT_REDEMPTIONS_EXHAUSTED",
	DISCOUNT_INVALID_AMOUNT: "DISCOUNT_INVALID_AMOUNT",
	DISCOUNT_STORE_MISMATCH: "DISCOUNT_STORE_MISMATCH",
	LICENSE_KEY_NOT_FOUND: "LICENSE_KEY_NOT_FOUND",
	LICENSE_KEY_DISABLED: "LICENSE_KEY_DISABLED",
	LICENSE_KEY_EXPIRED: "LICENSE_KEY_EXPIRED",
	LICENSE_KEY_AT_ACTIVATION_LIMIT: "LICENSE_KEY_AT_ACTIVATION_LIMIT",
	LICENSE_KEY_STORE_MISMATCH: "LICENSE_KEY_STORE_MISMATCH",
	PLAN_VARIANT_NOT_FOUND: "PLAN_VARIANT_NOT_FOUND",
	PLAN_NOT_SUBSCRIPTION: "PLAN_NOT_SUBSCRIPTION",
	PLAN_INVALID_INTERVAL: "PLAN_INVALID_INTERVAL",
	PLAN_FREE_PRICE: "PLAN_FREE_PRICE",
	PLAN_TRIAL_INCONSISTENT: "PLAN_TRIAL_INCONSISTENT",
	PLAN_DRAFT: "PLAN_DRAFT",
	PLAN_STORE_MISMATCH: "PLAN_STORE_MISMATCH",
} as const;

export type FindingCode = keyof typeof FINDING_CODES;

export type Severity = "info" | "warning" | "error";

export type CheckName =
	| "connection"
	| "store"
	| "product"
	| "webhook"
	| "discount"
	| "licenseKey"
	| "subscriptionPlan";

export interface Finding {
	code: FindingCode;
	severity: Severity;
	message: string;
	suggestedFix?: string;
	context?: Record<string, unknown>;
}

export interface CheckTarget {
	label: string;
	id?: string;
	url?: string;
}

export interface CheckReport<Resource = unknown> {
	name: CheckName;
	ok: boolean;
	mode: Mode;
	findings: Finding[];
	resource?: Resource;
	target?: CheckTarget;
}

export interface DoctorReport {
	ok: boolean;
	mode: Mode;
	checks: CheckReport[];
}

type RuleMessage<Subject> = string | ((subject: Subject) => string);

export interface FindingRule<Subject> {
	code: FindingCode;
	severity: Severity;
	when: (subject: Subject) => boolean;
	message: RuleMessage<Subject>;
	suggestedFix?: RuleMessage<Subject>;
	context?: (subject: Subject) => Finding["context"];
}

const isError = (finding: Finding) => finding.severity === "error";

const pickRuleMessage = <Subject>(
	message: RuleMessage<Subject>,
	subject: Subject,
) => {
	const isMessageComputed = typeof message === "function";
	return isMessageComputed ? message(subject) : message;
};

export const raiseFindings = <Subject>(
	rules: FindingRule<Subject>[],
	subject: Subject,
): Finding[] => {
	const raisedRules = rules.filter((rule) => rule.when(subject));
	return raisedRules.map((rule) => ({
		code: rule.code,
		severity: rule.severity,
		message: pickRuleMessage(rule.message, subject),
		suggestedFix:
			rule.suggestedFix && pickRuleMessage(rule.suggestedFix, subject),
		context: rule.context?.(subject),
	}));
};

export const createCheckReport = <Resource>(
	parts: Omit<CheckReport<Resource>, "ok">,
): CheckReport<Resource> => {
	const { name, mode, findings, resource, target } = parts;
	const hasError = findings.some(isError);
	return { name, ok: !hasError, mode, findings, resource, target };
};
