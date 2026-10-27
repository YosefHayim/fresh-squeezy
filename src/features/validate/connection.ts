import type {
	AuthenticatedUserDocument,
	StoreAttributes,
	UserAttributes,
} from "@/shared/attributes.js";
import type { Mode, ValidationResult } from "@/shared/contracts.js";
import type { HttpClient } from "@/shared/http.js";
import {
	buildResult,
	failedResult,
	ISSUE_CODES,
	type IssueRule,
	issuesOf,
} from "./issues.js";
import { probeCollection } from "./probe.js";

export interface ConnectionSummary {
	user: UserAttributes;
	storeCount: number;
	storeIds: string[];
	actualMode?: Mode;
	declaredMode: Mode;
}

export const resolveActualMode = (
	testMode: boolean | undefined,
): Mode | undefined => {
	const isTestKey = testMode === true;
	const isLiveKey = testMode === false;
	if (isTestKey) return "test";
	if (isLiveKey) return "live";
	return undefined;
};

const connectionIssueRules: IssueRule<ConnectionSummary>[] = [
	{
		code: ISSUE_CODES.MODE_MISMATCH,
		severity: "error",
		isRaised: ({ actualMode, declaredMode }) =>
			actualMode !== undefined && actualMode !== declaredMode,
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
		code: ISSUE_CODES.STORE_NOT_FOUND,
		severity: "warning",
		isRaised: ({ storeCount }) => storeCount === 0,
		message: "API key authenticated but no stores are reachable.",
		suggestedFix:
			"Confirm the API key belongs to an account that owns at least one store.",
	},
];

export const validateConnection = async (
	http: HttpClient,
	mode: Mode,
): Promise<ValidationResult<ConnectionSummary>> => {
	const fetched = await probeCollection(
		async () => {
			const userDocument = await http.request<AuthenticatedUserDocument>({
				path: "/v1/users/me",
			});
			const stores = await http.paginate<StoreAttributes>("/v1/stores");
			return { userDocument, stores };
		},
		{
			unauthorized: {
				code: ISSUE_CODES.AUTH_FAILED,
				message: "API key rejected by Lemon Squeezy.",
				suggestedFix:
					"Regenerate the key at https://app.lemonsqueezy.com/settings/api.",
			},
		},
	);

	const isFetchFailed = !fetched.ok;
	if (isFetchFailed) return failedResult("connection", mode, fetched.issue);

	const { userDocument, stores } = fetched.resource;
	const actualMode = resolveActualMode(userDocument.meta?.test_mode);
	const summary: ConnectionSummary = {
		user: userDocument.data.attributes,
		storeCount: stores.length,
		storeIds: stores.map((store) => store.id),
		declaredMode: mode,
		...(actualMode ? { actualMode } : {}),
	};

	const issues = issuesOf(connectionIssueRules, summary);
	return buildResult("connection", mode, issues, summary);
};
