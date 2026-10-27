import { isFreshSqueezyError } from "@/errors/errors.js";
import type { ValidationIssue } from "@/contracts/contracts.js";
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
	if (isFreshSqueezyError(err)) {
		if (
			mapping.unauthorized &&
			(err.status === 401 || err.code === "UNAUTHORIZED")
		) {
			return issue(
				mapping.unauthorized.code,
				"error",
				mapping.unauthorized.message,
				{
					suggestedFix: mapping.unauthorized.suggestedFix,
					context: { status: err.status ?? null },
				},
			);
		}
		if (mapping.notFound && err.status === 404) {
			return issue(mapping.notFound.code, "error", mapping.notFound.message, {
				suggestedFix: mapping.notFound.suggestedFix,
				context: mapping.notFound.context,
			});
		}
		if (err.code === "NETWORK_ERROR") {
			return issue(
				ISSUE_CODES.NETWORK_ERROR,
				"error",
				`Could not reach Lemon Squeezy: ${err.message}`,
			);
		}
		return issue(ISSUE_CODES.UNKNOWN, "error", err.message, {
			context: { status: err.status ?? null, code: err.code },
		});
	}
	const message = err instanceof Error ? err.message : "Unknown error";
	return issue(ISSUE_CODES.UNKNOWN, "error", message);
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
	if (expected === actual) return null;

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
