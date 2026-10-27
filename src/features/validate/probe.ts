import type { ResourceId, ValidationIssue } from "@/shared/contracts.js";
import { isFreshSqueezyError } from "@/shared/errors.js";
import { ISSUE_CODES, type IssueExtras, issue } from "./issues.js";

export interface IssueTemplate extends IssueExtras {
	code: string;
	message: string;
}

export interface IssueMapping {
	unauthorized?: Omit<IssueTemplate, "context">;
	notFound?: IssueTemplate;
}

export const mapErrorToIssue = (
	err: unknown,
	mapping: IssueMapping = {},
): ValidationIssue => {
	const isNotFreshSqueezyError = !isFreshSqueezyError(err);
	if (isNotFreshSqueezyError) {
		const isErrorInstance = err instanceof Error;
		const message = isErrorInstance ? err.message : "Unknown error";
		return issue(ISSUE_CODES.UNKNOWN, "error", message);
	}

	const { unauthorized, notFound } = mapping;
	const isUnauthorized =
		unauthorized && (err.status === 401 || err.code === "UNAUTHORIZED");
	if (isUnauthorized) {
		return issue(unauthorized.code, "error", unauthorized.message, {
			suggestedFix: unauthorized.suggestedFix,
			context: { status: err.status ?? null },
		});
	}

	const isNotFound = notFound && err.status === 404;
	if (isNotFound) {
		return issue(notFound.code, "error", notFound.message, {
			suggestedFix: notFound.suggestedFix,
			context: notFound.context,
		});
	}

	const isNetworkError = err.code === "NETWORK_ERROR";
	if (isNetworkError) {
		return issue(
			ISSUE_CODES.NETWORK_ERROR,
			"error",
			`Could not reach Lemon Squeezy: ${err.message}`,
		);
	}

	return issue(ISSUE_CODES.UNKNOWN, "error", err.message, {
		context: { status: err.status ?? null, code: err.code },
	});
};

export type FetchProbeOutcome<T> =
	| { ok: true; resource: T }
	| { ok: false; issue: ValidationIssue };

export const probeFetch = <T>(
	fetcher: () => Promise<T>,
	notFound: IssueTemplate,
): Promise<FetchProbeOutcome<T>> => probeCollection(fetcher, { notFound });

export const probeCollection = async <T>(
	fetcher: () => Promise<T>,
	mapping: IssueMapping = {},
): Promise<FetchProbeOutcome<T>> => {
	try {
		return { ok: true, resource: await fetcher() };
	} catch (err) {
		return { ok: false, issue: mapErrorToIssue(err, mapping) };
	}
};

export interface OwnershipCheck {
	expectedStoreId: ResourceId;
	actualStoreId: ResourceId;
	code: string;
	label: string;
	suggestedFix?: string;
	extraContext?: ValidationIssue["context"];
}

export const checkStoreOwnership = (
	check: OwnershipCheck,
): ValidationIssue[] => {
	const expected = String(check.expectedStoreId);
	const actual = String(check.actualStoreId);
	const isOwnedByExpectedStore = expected === actual;
	if (isOwnedByExpectedStore) return [];

	const mismatchIssue = issue(
		check.code,
		"error",
		`${check.label} belongs to store ${actual}, expected ${expected}.`,
		{
			suggestedFix: check.suggestedFix,
			context: {
				expectedStoreId: expected,
				actualStoreId: actual,
				...check.extraContext,
			},
		},
	);
	return [mismatchIssue];
};
