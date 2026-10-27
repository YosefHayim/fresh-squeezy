import { isFreshSqueezyError } from "@/shared/errors.js";
import type { Http, HttpQuery } from "@/shared/http.js";
import { FINDING_CODES, type Finding, type FindingCode } from "./findings.js";

const AUTH_FAILED_FINDING: Finding = {
	code: FINDING_CODES.AUTH_FAILED,
	severity: "error",
	message: "API key rejected by Lemon Squeezy.",
	suggestedFix:
		"Regenerate the key at https://app.lemonsqueezy.com/settings/api.",
	context: { status: 401 },
};

export type NotFoundFinding = Omit<Finding, "severity">;

export interface ResourceFetch {
	path: string;
	notFound: NotFoundFinding;
}

export interface CollectionFetch {
	path: string;
	query?: HttpQuery;
}

export type Fetched<Payload> =
	| { kind: "found"; payload: Payload }
	| { kind: "failed"; finding: Finding };

export interface StoreOwnership {
	label: string;
	code: FindingCode;
	expectedStoreId: string;
	actualStoreId: number;
	suggestedFix: string;
	extraContext?: Record<string, unknown>;
}

const findingOfError = (
	error: unknown,
	notFound?: NotFoundFinding,
): Finding => {
	const isOwnError = isFreshSqueezyError(error);
	const isForeignError = !isOwnError;
	if (isForeignError) {
		const isErrorInstance = error instanceof Error;
		const message = isErrorInstance ? error.message : "Unknown error";
		return { code: FINDING_CODES.UNKNOWN, severity: "error", message };
	}
	const isAuthFailed = error.status === 401 || error.code === "UNAUTHORIZED";
	if (isAuthFailed) return AUTH_FAILED_FINDING;
	const isNotFound = notFound !== undefined && error.status === 404;
	if (isNotFound) return { ...notFound, severity: "error" };
	const isNetworkError = error.code === "NETWORK_ERROR";
	if (isNetworkError) {
		return {
			code: FINDING_CODES.NETWORK_ERROR,
			severity: "error",
			message: `Could not reach Lemon Squeezy: ${error.message}`,
		};
	}
	return {
		code: FINDING_CODES.UNKNOWN,
		severity: "error",
		message: error.message,
		context: { status: error.status ?? null, code: error.code },
	};
};

export const fetchSafely = async <Payload>(
	load: () => Promise<Payload>,
	notFound?: NotFoundFinding,
): Promise<Fetched<Payload>> => {
	try {
		const payload = await load();
		return { kind: "found", payload };
	} catch (error) {
		const finding = findingOfError(error, notFound);
		return { kind: "failed", finding };
	}
};

const attributesOf = async <Attributes>(http: Http, path: string) => {
	const resource = await http.getResource<Attributes>(path);
	return resource.attributes;
};

export const fetchResource = <Attributes>(
	http: Http,
	{ path, notFound }: ResourceFetch,
) => fetchSafely(() => attributesOf<Attributes>(http, path), notFound);

export const fetchCollection = <Attributes>(
	http: Http,
	{ path, query }: CollectionFetch,
) => fetchSafely(() => http.getAll<Attributes>(path, query));

export const storeMismatchFindings = (ownership: StoreOwnership): Finding[] => {
	const expected = ownership.expectedStoreId;
	const actual = String(ownership.actualStoreId);
	const isSameStore = expected === actual;
	if (isSameStore) return [];
	return [
		{
			code: ownership.code,
			severity: "error",
			message: `${ownership.label} belongs to store ${actual}, expected ${expected}.`,
			suggestedFix: ownership.suggestedFix,
			context: {
				expectedStoreId: expected,
				actualStoreId: actual,
				...ownership.extraContext,
			},
		},
	];
};
