import type { StoreAttributes } from "@/shared/attributes.js";
import type { Mode, ResourceId, ValidationResult } from "@/shared/contracts.js";
import type { HttpClient } from "@/shared/http.js";
import { buildResult, failedResult, ISSUE_CODES } from "./issues.js";
import { probeFetch } from "./probe.js";

export const validateStore = async (
	http: HttpClient,
	mode: Mode,
	storeId: ResourceId,
): Promise<ValidationResult<StoreAttributes>> => {
	const target = { label: `store ${storeId}`, id: String(storeId) };

	const fetched = await probeFetch(
		() => http.getResource<StoreAttributes>(`/v1/stores/${storeId}`),
		{
			code: ISSUE_CODES.STORE_NOT_FOUND,
			message: `Store ${storeId} not found with the current API key.`,
			suggestedFix:
				"Check the store ID and confirm the API key belongs to the account that owns it.",
			context: { storeId: String(storeId) },
		},
	);

	const isFetchFailed = !fetched.ok;
	if (isFetchFailed) return failedResult("store", mode, fetched.issue, target);

	return buildResult("store", mode, [], fetched.resource.attributes, {
		label: fetched.resource.attributes.name,
		id: String(storeId),
	});
};
