import type { Mode } from "@/client/environment.js";
import type { Http } from "@/client/http.js";
import type { StoreAttributes } from "@/client/lemon-squeezy-types.js";
import { fetchResource } from "./fetch-resource.js";
import {
	type CheckReport,
	createCheckReport,
	FINDING_CODES,
} from "./findings.js";

export const validateStore = async (
	http: Http,
	mode: Mode,
	storeId: string,
): Promise<CheckReport<StoreAttributes>> => {
	const storeLookup = await fetchResource<StoreAttributes>(http, {
		path: `/v1/stores/${storeId}`,
		notFound: {
			code: FINDING_CODES.STORE_NOT_FOUND,
			message: `Store ${storeId} not found with the current API key.`,
			suggestedFix:
				"Check the store ID and confirm the API key belongs to the account that owns it.",
			context: { storeId },
		},
	});

	const isFetchFailed = storeLookup.kind === "failed";
	if (isFetchFailed) {
		return createCheckReport({
			name: "store",
			mode,
			findings: [storeLookup.finding],
			target: { label: `store ${storeId}`, id: storeId },
		});
	}

	const store = storeLookup.resource;
	return createCheckReport({
		name: "store",
		mode,
		findings: [],
		resource: store,
		target: { label: store.name, id: storeId },
	});
};
