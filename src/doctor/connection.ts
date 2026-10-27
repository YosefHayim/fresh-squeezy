import type { Mode } from "@/client/config.js";
import type { Http, JsonApiDocument } from "@/client/http.js";
import type {
	StoreAttributes,
	UserAttributes,
	UserMeta,
} from "@/client/lemon-squeezy-types.js";
import { fetchSafely } from "./fetch-resource.js";
import {
	buildCheckReport,
	type CheckReport,
	FINDING_CODES,
	type FindingRule,
	raiseFindings,
} from "./findings.js";

export interface ConnectionSummary {
	user: UserAttributes;
	storeCount: number;
	storeIds: string[];
	actualMode?: Mode;
	declaredMode: Mode;
}

type UserDocument = JsonApiDocument<UserAttributes> & { meta?: UserMeta };

const modeOfTestFlag = (testMode: boolean | undefined) => {
	const isTestKey = testMode === true;
	const isLiveKey = testMode === false;
	if (isTestKey) return "test";
	if (isLiveKey) return "live";
	return undefined;
};

const isModeMismatch = ({ actualMode, declaredMode }: ConnectionSummary) =>
	actualMode !== undefined && actualMode !== declaredMode;

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
		context: ({ actualMode, declaredMode }) => ({
			declared: declaredMode,
			actual: actualMode ?? null,
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
		return buildCheckReport({
			name: "connection",
			mode,
			findings: [accountLookup.finding],
		});
	}

	const { userDocument, stores } = accountLookup.resource;
	const actualMode = modeOfTestFlag(userDocument.meta?.test_mode);
	const summary: ConnectionSummary = {
		user: userDocument.data.attributes,
		storeCount: stores.length,
		storeIds: stores.map((store) => store.id),
		declaredMode: mode,
		...(actualMode ? { actualMode } : {}),
	};
	const findings = raiseFindings(CONNECTION_RULES, summary);
	return buildCheckReport({
		name: "connection",
		mode,
		findings,
		resource: summary,
	});
};
