import { isFreshSqueezyError } from "@/client/errors.js";
import type { Http, HttpQuery } from "@/client/http.js";
import { FINDING_CODES, type Finding, type FindingCode } from "./findings.js";

const AUTH_FAILED_FINDING: Finding = {
	code: FINDING_CODES.AUTH_FAILED,
	severity: "error",
	message: "API key rejected by Lemon Squeezy.",
	suggestedFix:
		"Regenerate the key at https://app.lemonsqueezy.com/settings/api.",
	context: { status: 401 },
};

export interface NotFoundFinding {
	code: FindingCode;
	message: string;
	suggestedFix?: string;
	context?: Record<string, unknown>;
}

export interface ResourceFetch {
	path: string;
	notFound: NotFoundFinding;
}

export interface CollectionFetch {
	path: string;
	query?: HttpQuery;
}

export type Lookup<Resource> =
	| { kind: "found"; resource: Resource }
	| { kind: "failed"; finding: Finding };

export interface StoreOwnership {
	label: string;
	code: FindingCode;
	expectedStoreId: string;
	actualStoreId: number;
	suggestedFix: string;
	extraDetails?: Record<string, unknown>;
}

const pickFindingForError = (
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

export const fetchSafely = async <Resource>(
	load: () => Promise<Resource>,
	notFound?: NotFoundFinding,
): Promise<Lookup<Resource>> => {
	try {
		const resource = await load();
		return { kind: "found", resource };
	} catch (error) {
		const finding = pickFindingForError(error, notFound);
		return { kind: "failed", finding };
	}
};

const fetchAttributes = async <Attributes>(http: Http, path: string) => {
	const resource = await http.getResource<Attributes>(path);
	return resource.attributes;
};

export const fetchResource = <Attributes>(
	http: Http,
	{ path, notFound }: ResourceFetch,
) => fetchSafely(() => fetchAttributes<Attributes>(http, path), notFound);

export const fetchCollection = <Attributes>(
	http: Http,
	{ path, query }: CollectionFetch,
) => fetchSafely(() => http.getAll<Attributes>(path, query));

export const storeMismatchFindings = (ownership: StoreOwnership): Finding[] => {
	const { expectedStoreId } = ownership;
	const actualStoreId = String(ownership.actualStoreId);
	const isSameStore = expectedStoreId === actualStoreId;
	if (isSameStore) return [];
	return [
		{
			code: ownership.code,
			severity: "error",
			message: `${ownership.label} belongs to store ${actualStoreId}, expected ${expectedStoreId}.`,
			suggestedFix: ownership.suggestedFix,
			context: {
				expectedStoreId,
				actualStoreId,
				...ownership.extraDetails,
			},
		},
	];
};
