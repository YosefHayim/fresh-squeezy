import type { HttpClient } from "../core/http.js";
import type { JsonApiDocument, JsonApiResource } from "../core/types.js";

/**
 * Subset of the Lemon Squeezy `users` resource attributes we rely on.
 * Full schema at https://docs.lemonsqueezy.com/api/users.
 */
export interface UserAttributes {
  name: string;
  email: string;
  color?: string;
  avatar_url?: string | null;
  has_custom_avatar?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Document-level metadata on `/v1/users/me`.
 *
 * `test_mode` was added to the endpoint on 2024-01-05 (per the Lemon Squeezy
 * API changelog: https://docs.lemonsqueezy.com/api/getting-started/changelog).
 * It reports whether the *key* being used is a test-mode key, independent of
 * what the caller declared. The connection validator compares this against
 * the caller's declared mode to catch the common "prod key in staging"
 * (or vice versa) misconfiguration.
 */
export interface UserMeta {
  test_mode?: boolean;
}

/**
 * Authenticated-user document with the `data` + `meta` block preserved.
 * The connection validator needs the meta flag, so we return the full
 * document here rather than just `data` as the collection helpers do.
 */
export type AuthenticatedUserDocument = JsonApiDocument<UserAttributes> & { meta?: UserMeta };

/**
 * Fetch the user associated with the API key. Primary use is the connection
 * validator: a successful call confirms the key is valid, surfaces the
 * account identity for logs, and exposes `meta.test_mode` for mode
 * mismatch detection.
 */
export async function getAuthenticatedUser(
  http: HttpClient
): Promise<AuthenticatedUserDocument> {
  return http.request<AuthenticatedUserDocument>({ path: "/v1/users/me" });
}

/**
 * Backwards-compatible helper if a caller only wants the resource (old
 * `getAuthenticatedUser` shape). Internal — not re-exported from the root.
 */
export function userResource(
  doc: AuthenticatedUserDocument
): JsonApiResource<UserAttributes> {
  return doc.data;
}
