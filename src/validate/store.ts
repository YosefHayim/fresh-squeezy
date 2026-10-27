import type { Mode, ValidationResult } from "@/contracts/contracts.js";
import type { HttpClient } from "@/http/http.js";
import type { StoreAttributes } from "@/resources/attributes.js";
import { buildResult, ISSUE_CODES } from "./issues.js";
import { probeFetch } from "./probe.js";

export const validateStore = async (
	http: HttpClient,
	mode: Mode,
	storeId: string | number,
): Promise<ValidationResult<StoreAttributes>> => {
	const target = { label: `store ${storeId}`, id: String(storeId) };

	const fetched = await probeFetch(
		() => http.getResource<StoreAttributes>(`/v1/stores/${storeId}`),
		{
			notFoundCode: ISSUE_CODES.STORE_NOT_FOUND,
			notFoundMessage: `Store ${storeId} not found with the current API key.`,
			notFoundFix:
				"Check the store ID and confirm the API key belongs to the account that owns it.",
			notFoundContext: { storeId: String(storeId) },
		},
	);

	const isFetchFailed = !fetched.ok;
	if (isFetchFailed) {
		return buildResult<StoreAttributes>(
			"store",
			mode,
			[fetched.issue],
			undefined,
			target,
		);
	}

	return buildResult("store", mode, [], fetched.resource.attributes, {
		label: fetched.resource.attributes.name,
		id: String(storeId),
	});
};
