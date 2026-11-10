import type { Mode } from "@/client/environment.js";
import type { Http, JsonApiResource } from "@/client/http.js";
import type {
	StoreAttributes,
	UserAttributes,
	UserMeta,
} from "@/client/lemon-squeezy-types.js";
import { createFailedLookupReport, fetchSafely } from "./fetch-resource.js";
import {
	type CheckReport,
	createCheckReport,
	FINDING_CODES,
	type FindingRule,
	raiseFindings,
} from "./findings.js";

export interface ConnectionSummary {
	user: UserAttributes;
	storeCount: number;
	storeIds: string[];
	actualMode: Mode | null;
	declaredMode: Mode;
}

interface UserDocument {
	data: JsonApiResource<UserAttributes>;
	meta?: UserMeta;
}

const pickModeForTestFlag = (testMode: boolean | undefined): Mode | null => {
	const isTestKey = testMode === true;
	if (isTestKey) return "test";

	const isLiveKey = testMode === false;
	if (isLiveKey) return "live";

	return null;
};

const isModeMismatch = ({ actualMode, declaredMode }: ConnectionSummary) => {
	const isModeKnown = actualMode != null;
	return isModeKnown && actualMode !== declaredMode;
};

const hasNoStores = ({ storeCount }: ConnectionSummary) => storeCount === 0;

const CONNECTION_RULES: FindingRule<ConnectionSummary>[] = [
	{
		code: FINDING_CODES.MODE_MISMATCH,
		severity: "error",
		when: isModeMismatch,
		message: ({ actualMode, declaredMode }) =>
			`API key is a ${actualMode}-mode key but was run with --mode ${declaredMode}.`,
		suggestedFix: ({ actualMode, declaredMode }) =>
			`Either pass --mode ${actualMode} or use a ${declaredMode}-mode key from https://app.lemonsqueezy.com/settings/api.`,
		details: ({ actualMode, declaredMode }) => ({
			declared: declaredMode,
			actual: actualMode,
		}),
	},
	{
		code: FINDING_CODES.STORE_NOT_FOUND,
		severity: "warning",
		when: hasNoStores,
		message: "API key authenticated but no stores are reachable.",
		suggestedFix:
			"Confirm the API key belongs to an account that owns at least one store.",
	},
];

export const validateConnection = async (
	http: Http,
	mode: Mode,
): Promise<CheckReport<ConnectionSummary>> => {
	const accountLookup = await fetchSafely(async () => {
		const userDocument = await http.request<UserDocument>({
			path: "/v1/users/me",
		});

		const stores = await http.getAll<StoreAttributes>("/v1/stores");
		return { userDocument, stores };
	});

	const isFetchFailed = accountLookup.kind === "failed";
	if (isFetchFailed) {
		return createFailedLookupReport({
			name: "connection",
			mode,
			finding: accountLookup.finding,
			target: null,
		});
	}

	const { userDocument, stores } = accountLookup.resource;
	const summary: ConnectionSummary = {
		user: userDocument.data.attributes,
		storeCount: stores.length,
		storeIds: stores.map((store) => store.id),
		actualMode: pickModeForTestFlag(userDocument.meta?.test_mode),
		declaredMode: mode,
	};

	const findings = raiseFindings(CONNECTION_RULES, summary);
	return createCheckReport({
		name: "connection",
		mode,
		findings,
		resource: summary,
		target: null,
	});
};
