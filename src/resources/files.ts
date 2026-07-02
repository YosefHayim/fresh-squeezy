import type { HttpClient } from "../core/http.js";
import type { JsonApiResource } from "../core/types.js";
import type { GeneratedFileAttributes } from "../generated/lemonSqueezyApiTypes.js";

/**
 * Lemon Squeezy file attributes, generated from the public object docs.
 * Exposed so consumers can type file-resource escape-hatch calls without
 * waiting for a hand-written validator.
 */
export interface FileAttributes extends GeneratedFileAttributes {}

export async function getFile(
  http: HttpClient,
  fileId: string | number,
): Promise<JsonApiResource<FileAttributes>> {
  return http.getResource<FileAttributes>(`/v1/files/${fileId}`);
}

export async function listFilesForVariant(
  http: HttpClient,
  variantId: string | number,
): Promise<JsonApiResource<FileAttributes>[]> {
  return http.paginate<FileAttributes>("/v1/files", {
    "filter[variant_id]": String(variantId),
  });
}
