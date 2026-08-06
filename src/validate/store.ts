import type { HttpClient } from "../core/http.js";
import type { Mode, ValidationResult } from "../core/types.js";
import { type StoreAttributes, getStore } from "../resources/stores.js";
import { probeFetch } from "./probe.js";
import { ISSUE_CODES, buildResult } from "./rules.js";

/**
 * Verify a store exists and is reachable with the current API key. A 404
 * typically means the key belongs to a different account, not that the store
 * is gone — the suggested fix reflects that.
 */
export const validateStore = async (
  http: HttpClient,
  mode: Mode,
  storeId: string | number,
): Promise<ValidationResult<StoreAttributes>> => {
  const target = { label: `store ${storeId}`, id: String(storeId) };

  const fetched = await probeFetch(() => getStore(http, storeId), {
    notFoundCode: ISSUE_CODES.STORE_NOT_FOUND,
    notFoundMessage: `Store ${storeId} not found with the current API key.`,
    notFoundFix: "Check the store ID and confirm the API key belongs to the account that owns it.",
    notFoundContext: { storeId: String(storeId) },
  });

  if (!fetched.ok) {
    return buildResult<StoreAttributes>("store", mode, [fetched.issue], undefined, target);
  }

  return buildResult("store", mode, [], fetched.resource.attributes, {
    label: fetched.resource.attributes.name,
    id: String(storeId),
  });
};
