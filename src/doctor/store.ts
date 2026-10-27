import type { Mode } from "@/client/config.js";
import type { Http } from "@/client/http.js";
import type { StoreAttributes } from "@/client/lemon-squeezy-types.js";
import { fetchResource } from "./fetch-resource.js";
import {
	buildResult,
	FINDING_CODES,
	type ValidationResult,
} from "./findings.js";

export const validateStore = async (
	http: Http,
	mode: Mode,
	storeId: string,
): Promise<ValidationResult<StoreAttributes>> => {
	const fetched = await fetchResource<StoreAttributes>(http, {
		path: `/v1/stores/${storeId}`,
		notFound: {
			code: FINDING_CODES.STORE_NOT_FOUND,
			message: `Store ${storeId} not found with the current API key.`,
			suggestedFix:
				"Check the store ID and confirm the API key belongs to the account that owns it.",
			context: { storeId },
		},
	});

	const isFetchFailed = fetched.kind === "failed";
	if (isFetchFailed) {
		return buildResult({
			name: "store",
			mode,
			findings: [fetched.finding],
			target: { label: `store ${storeId}`, id: storeId },
		});
	}

	const store = fetched.payload;
	return buildResult({
		name: "store",
		mode,
		findings: [],
		resource: store,
		target: { label: store.name, id: storeId },
	});
};
