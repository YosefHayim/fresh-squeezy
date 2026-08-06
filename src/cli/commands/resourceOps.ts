import { readFileSync } from "node:fs";
import { resolveConfig } from "../../core/config.js";
import { FreshSqueezyError } from "../../core/errors.js";
import { HttpClient } from "../../core/http.js";
import type { Mode } from "../../core/types.js";
import { createFreshSqueezy } from "../../createFreshSqueezy.js";
import { invokeOp } from "../../resources/invokeOp.js";
import {
  type OpVerb,
  findResourceVerb,
  listRegisteredResources,
  resourceRegistry,
} from "../../resources/registry.js";
import { renderCliError } from "../errors.js";
import { confirmResourceOp } from "../prompts.js";

/**
 * Options for hybrid resource ops (get/list/create/…/refund).
 */
export interface ResourceOpCommandOptions {
  resource: string;
  verb: OpVerb | string;
  mode?: Mode;
  id?: string;
  storeIds?: string[];
  parentId?: string;
  body?: string;
  bodyFile?: string;
  yes?: boolean;
  json?: boolean;
  isInteractive?: boolean;
  listCatalog?: boolean;
}

/**
 * Run a docs-backed resource op from the CLI.
 *
 * Dual-mode: non-TTY never prompts; live writes and destructive verbs need
 * `--yes` or TTY confirm.
 *
 * @param options - Verb, resource, flags, body sources.
 * @returns Process exit code (0 success, 2 fatal/usage).
 *
 * @example
 * ```ts
 * await runResourceOpCommand({
 *   verb: "get",
 *   resource: "product",
 *   id: "42",
 *   json: true,
 * });
 * ```
 */
export const runResourceOpCommand = async (options: ResourceOpCommandOptions): Promise<number> => {
  if (options.listCatalog) {
    writeCatalog(options.json ?? false);
    return 0;
  }

  const spec = findResourceVerb(options.resource, options.verb);
  if (!spec) {
    process.stderr.write(
      renderCliError(`Unknown or unsupported op: ${options.verb} ${options.resource}`, [
        "fresh-squeezy ops --list",
        "fresh-squeezy get product --id 1",
        "fresh-squeezy list webhook --store-ids 1",
      ]),
    );
    return 2;
  }

  try {
    const body = readBody(options);
    if (spec.body === "required" && body === undefined) {
      throw new FreshSqueezyError({
        code: "MISSING_ARG",
        message: "This op requires a JSON body (--body, --body-file, or stdin).",
      });
    }

    const client = createFreshSqueezy({ mode: options.mode });
    const allowed = await assertWriteSafety(spec, client.mode, options);
    if (!allowed) return 2;

    const config = resolveConfig({ mode: options.mode });
    const http = new HttpClient(config);
    const opBody = await invokeOp(http, options.resource, options.verb, {
      id: options.id,
      storeId: options.storeIds?.[0],
      parentId: options.parentId,
      body,
    });

    const envelope = {
      ok: true as const,
      mode: client.mode,
      resource: spec.resource,
      verb: spec.verb,
      docs: `https://docs.lemonsqueezy.com/api/${spec.docsPath}`,
      data: opBody ?? null,
    };

    if (options.json) {
      process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
    } else {
      process.stdout.write(
        `${spec.verb} ${spec.resource} — ok (mode=${client.mode})\n` +
          `${JSON.stringify(opBody ?? null, null, 2)}\n`,
      );
    }
    return 0;
  } catch (err) {
    writeFatal(err, options.json ?? false);
    return 2;
  }
};

/**
 * Print the implemented ops matrix (docs-backed).
 *
 * @param asJson - Machine-readable when true.
 */
const writeCatalog = (asJson: boolean): void => {
  if (asJson) {
    process.stdout.write(
      `${JSON.stringify(
        {
          resources: listRegisteredResources(),
          ops: resourceRegistry,
        },
        null,
        2,
      )}\n`,
    );
    return;
  }
  process.stdout.write("Docs-backed ops (Lemon Squeezy official API only):\n\n");
  for (const entry of resourceRegistry) {
    const flags = [
      entry.destructive ? "destructive" : undefined,
      entry.body && entry.body !== "none" ? `body=${entry.body}` : undefined,
    ]
      .filter(Boolean)
      .join(", ");
    process.stdout.write(
      `  ${entry.verb.padEnd(18)} ${entry.resource.padEnd(22)} ${entry.docsPath}${flags ? `  (${flags})` : ""}\n`,
    );
  }
  process.stdout.write(
    "\nCatalog resources (product, variant, price, file, store, …) are read-only in the API.\n",
  );
};

const assertWriteSafety = async (
  spec: NonNullable<ReturnType<typeof findResourceVerb>>,
  mode: Mode,
  options: ResourceOpCommandOptions,
): Promise<boolean> => {
  const isWrite = spec.verb !== "get" && spec.verb !== "list" && spec.verb !== "current-usage";
  if (!isWrite) return true;

  const needsGate = Boolean(spec.destructive) || mode === "live";
  if (!needsGate) return true;

  if (options.yes) return true;

  if (options.isInteractive) {
    return confirmResourceOp(
      mode === "live"
        ? `LIVE mode: allow ${spec.verb} ${spec.resource}?`
        : `Confirm ${spec.verb} ${spec.resource}?`,
    );
  }

  process.stderr.write(
    renderCliError(
      `${spec.verb} ${spec.resource} requires --yes in non-interactive ${mode} mode${spec.destructive ? " (destructive op)" : ""}`,
      [
        `fresh-squeezy ${spec.verb} ${spec.resource} --yes …`,
        "Use test mode for safer experimentation: --mode test",
      ],
    ),
  );
  return false;
};

const readBody = (options: ResourceOpCommandOptions): unknown | undefined => {
  // Bodies come from flags only — never auto-read stdin (would hang non-TTY pipes).
  if (options.bodyFile) {
    return JSON.parse(readFileSync(options.bodyFile, "utf8")) as unknown;
  }
  if (options.body !== undefined) {
    return JSON.parse(options.body) as unknown;
  }
  return undefined;
};

const writeFatal = (err: unknown, json: boolean): void => {
  if (json) {
    const code = err instanceof FreshSqueezyError ? err.code : "FATAL";
    const message = err instanceof Error ? err.message : String(err);
    const status = err instanceof FreshSqueezyError ? err.status : undefined;
    process.stderr.write(
      `${JSON.stringify({ ok: false, error: { code, message, status } }, null, 2)}\n`,
    );
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(renderCliError(message, ["fresh-squeezy ops --list"]));
};
