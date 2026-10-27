import type {
	Mode,
	ValidationIssue,
	ValidationResult,
} from "@/contracts/contracts.js";
import type { HttpClient } from "@/http/http.js";
import type {
	AuthenticatedUserDocument,
	StoreAttributes,
	UserAttributes,
} from "@/resources/attributes.js";
import { buildResult, ISSUE_CODES, issue } from "./issues.js";
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

const fetchUserDocument = (
	http: HttpClient,
): Promise<AuthenticatedUserDocument> => {
	return http.request<AuthenticatedUserDocument>({ path: "/v1/users/me" });
};

export const validateConnection = async (
	http: HttpClient,
	mode: Mode,
): Promise<ValidationResult<ConnectionSummary>> => {
	const fetched = await probeCollection(
		async () => {
			const userDoc = await fetchUserDocument(http);
			const stores = await http.paginate<StoreAttributes>("/v1/stores");
			return { userDoc, stores };
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
	if (isFetchFailed) {
		return buildResult("connection", mode, [fetched.issue]);
	}

	const { userDoc, stores } = fetched.resource;
	const actualMode = resolveActualMode(userDoc.meta?.test_mode);
	const summary: ConnectionSummary = {
		user: userDoc.data.attributes,
		storeCount: stores.length,
		storeIds: stores.map((store) => store.id),
		declaredMode: mode,
		...(actualMode ? { actualMode } : {}),
	};

	const issues: ValidationIssue[] = [];

	const isModeMismatched = actualMode && actualMode !== mode;
	if (isModeMismatched) {
		const modeMismatchIssue = issue(
			ISSUE_CODES.MODE_MISMATCH,
			"error",
			`API key is a ${actualMode}-mode key but was run with --mode ${mode}.`,
			{
				suggestedFix: `Either pass --mode ${actualMode} or use a ${mode}-mode key from https://app.lemonsqueezy.com/settings/api.`,
				context: { declared: mode, actual: actualMode },
			},
		);
		issues.push(modeMismatchIssue);
	}

	const isThereNoStore = stores.length === 0;
	if (isThereNoStore) {
		const noStoreIssue = issue(
			ISSUE_CODES.STORE_NOT_FOUND,
			"warning",
			"API key authenticated but no stores are reachable.",
			{
				suggestedFix:
					"Confirm the API key belongs to an account that owns at least one store.",
			},
		);
		issues.push(noStoreIssue);
	}

	return buildResult("connection", mode, issues, summary);
};

export const fetchActualMode = async (
	http: HttpClient,
): Promise<Mode | undefined> => {
	const doc = await fetchUserDocument(http);
	return resolveActualMode(doc.meta?.test_mode);
};
