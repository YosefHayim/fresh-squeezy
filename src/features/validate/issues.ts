import type {
	ValidationIssue,
	ValidationResult,
	ValidationSeverity,
	ValidationTarget,
} from "@/shared/contracts.js";

export const ISSUE_CODES = {
	AUTH_FAILED: "AUTH_FAILED",
	MODE_MISMATCH: "MODE_MISMATCH",
	STORE_NOT_FOUND: "STORE_NOT_FOUND",
	STORE_NOT_OWNED: "STORE_NOT_OWNED",
	PRODUCT_NOT_FOUND: "PRODUCT_NOT_FOUND",
	PRODUCT_WRONG_STORE: "PRODUCT_WRONG_STORE",
	PRODUCT_UNPUBLISHED: "PRODUCT_UNPUBLISHED",
	PRODUCT_NO_BUY_URL: "PRODUCT_NO_BUY_URL",
	VARIANT_UNPUBLISHED: "VARIANT_UNPUBLISHED",
	VARIANT_MISSING: "VARIANT_MISSING",
	WEBHOOK_NOT_FOUND: "WEBHOOK_NOT_FOUND",
	WEBHOOK_EVENTS_MISSING: "WEBHOOK_EVENTS_MISSING",
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
	NETWORK_ERROR: "NETWORK_ERROR",
	UNKNOWN: "UNKNOWN",
} as const;

export type IssueExtras = Pick<ValidationIssue, "suggestedFix" | "context">;

export const issue = (
	code: string,
	severity: ValidationSeverity,
	message: string,
	extras: IssueExtras = {},
): ValidationIssue => {
	const base: ValidationIssue = { code, severity, message };
	const isThereSuggestedFix = extras.suggestedFix !== undefined;
	const isThereContext = extras.context !== undefined;
	if (isThereSuggestedFix) base.suggestedFix = extras.suggestedFix;
	if (isThereContext) base.context = extras.context;
	return base;
};

const isOk = (issues: ValidationIssue[]): boolean => {
	return !issues.some((entry) => entry.severity === "error");
};

export const buildResult = <T>(
	name: string,
	mode: ValidationResult["mode"],
	issues: ValidationIssue[],
	resource?: T,
	target?: ValidationTarget,
): ValidationResult<T> => {
	const validation: ValidationResult<T> = {
		name,
		ok: isOk(issues),
		mode,
		issues,
	};
	const isThereResource = resource !== undefined;
	const isThereTarget = target !== undefined;
	if (isThereResource) validation.resource = resource;
	if (isThereTarget) validation.target = target;
	return validation;
};

export const failedResult = <T>(
	name: string,
	mode: ValidationResult["mode"],
	failedIssue: ValidationIssue,
	target?: ValidationTarget,
): ValidationResult<T> =>
	buildResult<T>(name, mode, [failedIssue], undefined, target);

type RuleText<Subject> = string | ((subject: Subject) => string);

export interface IssueRule<Subject> {
	code: string;
	severity: ValidationSeverity;
	isRaised: (subject: Subject) => boolean;
	message: RuleText<Subject>;
	suggestedFix?: RuleText<Subject>;
	context?: (subject: Subject) => ValidationIssue["context"];
}

const textOf = <Subject>(text: RuleText<Subject>, subject: Subject): string => {
	const isTextComputed = typeof text === "function";
	return isTextComputed ? text(subject) : text;
};

export const issuesOf = <Subject>(
	rules: IssueRule<Subject>[],
	subject: Subject,
): ValidationIssue[] => {
	const raisedRules = rules.filter((rule) => rule.isRaised(subject));
	return raisedRules.map((rule) => {
		const message = textOf(rule.message, subject);
		const suggestedFix =
			rule.suggestedFix && textOf(rule.suggestedFix, subject);
		const context = rule.context?.(subject);
		return issue(rule.code, rule.severity, message, { suggestedFix, context });
	});
};
