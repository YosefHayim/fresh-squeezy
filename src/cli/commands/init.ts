import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import { ENV_KEYS } from "../../core/config.js";
import type { Mode, ValidationResult } from "../../core/types.js";
import { type FreshSqueezyClient, createFreshSqueezy } from "../../createFreshSqueezy.js";
import type { ConnectionSummary } from "../../validate/connection.js";
import {
  type DiscoveredChoices,
  OPTIONAL_VALIDATORS,
  type OptionalValidatorIds,
  type OptionalValidatorName,
  discoverChoices,
} from "../optionalValidators.js";
import {
  askForApiKey,
  askForValidatorIds,
  confirmLiveModeRun,
  confirmWriteEnvFile,
  isPromptCancel,
  pickStore,
  selectOptionalValidators,
} from "../prompts.js";
import {
  renderBrandHeader,
  renderCancelMessage,
  renderCliError,
  renderDetected,
  renderReport,
  renderStep,
} from "../render.js";
import { type StoreChoice, listStoreChoices } from "../resolveStores.js";

export interface InitCommandOptions {
  envFile?: string;
  isInteractive?: boolean;
}

/**
 * `fresh-squeezy init` — interactive onboarding. Walks the user through the
 * fastest path from "I have an API key" to "my integration is verified":
 *
 *  1. Read API key from env or ask for it if missing.
 *  2. List reachable stores via `/v1/stores`, let the user pick one.
 *  3. Ask which resource-specific validators should run now.
 *  4. Optionally persist credentials to `.env`.
 *  5. Run `doctor()` against the chosen config and print the report.
 *
 * Returns an exit code so the CLI wrapper can set it as `process.exitCode`.
 */
export const runInitCommand = async (options: InitCommandOptions = {}): Promise<number> => {
  try {
    return await runInitFlow(options);
  } catch (err) {
    if (isPromptCancel(err)) {
      process.stderr.write(renderCancelMessage());
      return 130;
    }
    throw err;
  }
};

const runInitFlow = async (options: InitCommandOptions): Promise<number> => {
  if (options.isInteractive === false) {
    process.stderr.write(
      renderCliError("`fresh-squeezy init` requires an interactive terminal.", [
        "fresh-squeezy doctor --all-stores",
        "fresh-squeezy validate connection",
      ]),
    );
    return 2;
  }

  process.stdout.write(
    renderBrandHeader(
      "Guided setup",
      "Connect a key, pick the right store, and run a focused billing doctor.",
    ),
  );

  process.stdout.write(renderStep(1, 5, "Credentials", "reuse env when available"));
  const apiKey = await resolveApiKey();

  process.stdout.write(renderStep(2, 5, "Account probe", "detect mode and reachable stores"));
  const { client, connection } = await connectWithDetectedMode(apiKey);
  const mode = client.mode;

  if (!connection.ok) {
    process.stdout.write(`${renderReport({ ok: false, mode, results: [connection] })}\n`);
    return 1;
  }

  if (mode === "live" && !(await confirmLiveModeRun())) {
    process.stderr.write(renderCancelMessage());
    return 130;
  }

  const stores = await listStoreChoices(client);
  if (stores.length === 0) {
    process.stdout.write(
      chalk.yellow(
        "No stores reachable with this key. Create a store in Lemon Squeezy and retry.\n",
      ),
    );
    return 1;
  }

  process.stdout.write(renderDetected("Stores", String(stores.length), "Lemon Squeezy API"));
  process.stdout.write(renderStep(3, 5, "Store selection", "auto-select when unambiguous"));
  const storeId = await resolveStoreSelection(stores);

  process.stdout.write(renderStep(4, 5, "Optional checks", "pick resources before manual IDs"));
  const selectedValidators = await selectOptionalValidators();
  const resourceChoices = await discoverChoices(client, storeId, selectedValidators);
  process.stdout.write(renderDiscoverySummary(resourceChoices, selectedValidators));
  const validatorIds = await askForValidatorIds(selectedValidators, resourceChoices);

  const envPath = path.resolve(process.cwd(), options.envFile ?? ".env");
  const checkNames = listValidatorNames(validatorIds);
  process.stdout.write(renderSetupSummary({ envPath, mode, storeId, checkNames }));
  const shouldWrite = await confirmWriteEnvFile(envPath);
  if (shouldWrite) {
    await writeEnvFile(envPath, { apiKey, mode, storeId });
    process.stdout.write(chalk.green(`Wrote ${envPath}\n`));
  }

  process.stdout.write(chalk.dim(`\nRunning doctor (${checkNames.join(", ")})...\n\n`));
  const report = await client.doctor({ storeId, ...validatorIds });
  process.stdout.write(`${renderReport(report)}\n`);

  return report.ok ? 0 : 1;
};

const resolveStoreSelection = async (stores: StoreChoice[]): Promise<string> => {
  const [only, ...others] = stores;
  if (only && others.length === 0) {
    process.stdout.write(renderDetected("Store", `${only.name} (${only.slug})`, `id ${only.id}`));
    return only.id;
  }

  return pickStore(stores);
};

const resolveApiKey = async (): Promise<string> => {
  const envApiKey = process.env[ENV_KEYS.apiKey]?.trim();
  if (envApiKey) {
    process.stdout.write(chalk.dim(`Using ${ENV_KEYS.apiKey} from environment.\n`));
    return envApiKey;
  }

  const answers = await askForApiKey();
  return answers.apiKey;
};

/** A client built for the key's real mode, plus the connection result that detected it. */
interface DetectedConnection {
  client: FreshSqueezyClient;
  connection: ValidationResult<ConnectionSummary>;
}

const connectWithDetectedMode = async (apiKey: string): Promise<DetectedConnection> => {
  const envMode = parseEnvMode();
  const initialMode = envMode ?? "test";
  let client = createFreshSqueezy({ apiKey, mode: initialMode });
  let connection = await client.validateConnection();
  const actualMode = connection.resource?.actualMode;

  if (actualMode && actualMode !== initialMode) {
    const message = envMode
      ? `Detected ${actualMode}-mode API key; ignoring ${ENV_KEYS.mode}=${initialMode} for this run.`
      : `Detected ${actualMode}-mode API key.`;
    process.stdout.write(chalk.yellow(`${message}\n`));
    client = createFreshSqueezy({ apiKey, mode: actualMode });
    connection = await client.validateConnection();
    return { client, connection };
  }

  if (actualMode) {
    process.stdout.write(chalk.dim(`Detected ${actualMode}-mode API key.\n`));
    return { client, connection };
  }

  if (envMode) {
    process.stdout.write(
      chalk.dim(`Using ${ENV_KEYS.mode}=${envMode}; API mode was not exposed.\n`),
    );
    return { client, connection };
  }

  process.stdout.write(chalk.dim("Could not auto-detect key mode; using test mode.\n"));
  return { client, connection };
};

const parseEnvMode = (): Mode | undefined => {
  const value = process.env[ENV_KEYS.mode]?.trim();
  if (value === "test" || value === "live") return value;
  if (value) {
    process.stdout.write(
      chalk.yellow(`Ignoring invalid ${ENV_KEYS.mode}=${value}; expected test or live.\n`),
    );
  }
  return undefined;
};

const listValidatorNames = (validatorIds: OptionalValidatorIds): string[] => {
  const names = ["connection", "store"];
  for (const row of OPTIONAL_VALIDATORS) {
    const count = validatorIds[row.field]?.length ?? 0;
    if (count > 0) names.push(count === 1 ? row.resultName : `${row.resultName} x${count}`);
  }
  return names;
};

const renderSetupSummary = (input: {
  envPath: string;
  mode: Mode;
  storeId: string;
  checkNames: string[];
}): string => {
  return [
    renderStep(5, 5, "Ready to verify", "review before writing env"),
    `  ${chalk.dim("mode")}   ${input.mode}`,
    `  ${chalk.dim("store")}  ${input.storeId}`,
    `  ${chalk.dim("checks")} ${input.checkNames.join(", ")}`,
    `  ${chalk.dim("env")}    ${input.envPath}`,
    "",
  ].join("\n");
};

const writeEnvFile = async (
  envPath: string,
  values: { apiKey: string; mode: string; storeId: string },
): Promise<void> => {
  const updates = new Map<string, string>([
    [ENV_KEYS.apiKey, values.apiKey],
    [ENV_KEYS.storeId, values.storeId],
    [ENV_KEYS.mode, values.mode],
  ]);
  const existing = await readEnvFile(envPath);
  const lines = existing.length > 0 ? existing.split(/\r?\n/) : [];
  const seen = new Set<string>();
  const next = lines.map((line) => {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(line);
    const key = match?.[1];
    if (!key || !updates.has(key)) return line;
    seen.add(key);
    return `${key}=${updates.get(key) ?? ""}`;
  });

  if (next.length > 0 && next.at(-1) !== "") {
    next.push("");
  }

  for (const [key, value] of updates) {
    if (!seen.has(key)) {
      next.push(`${key}=${value}`);
    }
  }

  await fs.mkdir(path.dirname(envPath), { recursive: true });
  await fs.writeFile(envPath, `${next.join("\n").replace(/\n*$/, "")}\n`, { encoding: "utf8" });
};

const readEnvFile = async (envPath: string): Promise<string> => {
  try {
    return await fs.readFile(envPath, "utf8");
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      return "";
    }
    throw err;
  }
};

const renderDiscoverySummary = (
  choices: DiscoveredChoices,
  selectedValidators: OptionalValidatorName[],
): string => {
  if (selectedValidators.length === 0)
    return chalk.dim("  No optional resource checks selected.\n");

  const lines = OPTIONAL_VALIDATORS.filter((row) => selectedValidators.includes(row.name)).map(
    (row) => {
      const group = choices[row.name];
      if (group?.error) {
        return chalk.yellow(`  ! ${row.label} discovery failed; manual entry is available.`);
      }
      const count = String(group?.choices.length ?? 0);
      return renderDetected(row.label, count, "Lemon Squeezy API").trimEnd();
    },
  );
  return `${lines.join("\n")}\n`;
};
