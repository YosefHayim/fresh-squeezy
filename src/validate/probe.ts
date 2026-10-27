import type { ValidationIssue } from "@/contracts/contracts.js";
import { isFreshSqueezyError } from "@/errors/errors.js";
import { ISSUE_CODES, issue } from "./issues.js";

export interface IssueMapping {
	unauthorized?: { code: string; message: string; suggestedFix?: string };
	notFound?: {
		code: string;
		message: string;
		suggestedFix?: string;
		context?: ValidationIssue["context"];
	};
}

export const mapErrorToIssue = (
	err: unknown,
	mapping: IssueMapping = {},
): ValidationIssue => {
	const isPlainError = !isFreshSqueezyError(err);
	if (isPlainError) {
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

export interface FetchProbeOptions {
	notFoundCode: string;
	notFoundMessage: string;
	notFoundFix?: string;
	notFoundContext?: ValidationIssue["context"];
}

export type FetchProbeOutcome<T> =
	| { ok: true; resource: T }
	| { ok: false; issue: ValidationIssue };

export const probeFetch = async <T>(
	fetcher: () => Promise<T>,
	options: FetchProbeOptions,
): Promise<FetchProbeOutcome<T>> => {
	return probeCollection(fetcher, {
		notFound: {
			code: options.notFoundCode,
			message: options.notFoundMessage,
			suggestedFix: options.notFoundFix,
			context: options.notFoundContext,
		},
	});
};

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
	expectedStoreId: string | number;
	actualStoreId: string | number;
	code: string;
	label: string;
	suggestedFix?: string;
	extraContext?: ValidationIssue["context"];
}

export const checkStoreOwnership = (
	check: OwnershipCheck,
): ValidationIssue | null => {
	const expected = String(check.expectedStoreId);
	const actual = String(check.actualStoreId);
	const isOwnedByExpectedStore = expected === actual;
	if (isOwnedByExpectedStore) return null;

	return issue(
		check.code,
		"error",
		`${check.label} belongs to store ${actual}, expected ${expected}.`,
		{
			suggestedFix: check.suggestedFix,
			context: {
				expectedStoreId: expected,
				actualStoreId: actual,
				...(check.extraContext ?? {}),
			},
		},
	);
};
