import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import { ENV_KEYS } from "../../core/config.js";
import type { Mode, ValidationResult } from "../../core/types.js";
import { type FreshSqueezyClient, createFreshSqueezy } from "../../createFreshSqueezy.js";
import type { ConnectionSummary } from "../../validate/connection.js";
import { renderBrandHeader, renderCancelMessage, renderDetected, renderStep } from "../brand.js";
import { renderCliError } from "../errors.js";
import {
  type InitDoctorTarget,
  type InitDoctorTargets,
  askForApiKey,
  askForDoctorTargetValues,
  confirmLiveModeRun,
  confirmWriteEnvFile,
  isPromptCancel,
  pickStore,
  selectDoctorTargets,
} from "../prompts.js";
import { renderReport } from "../render.js";
import {
  EMPTY_INIT_RESOURCE_CHOICES,
  type InitResourceChoices,
  type ResourceChoiceGroup,
  discoverInitResourceChoices,
} from "../resourceDiscovery.js";

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
 * Returns an exit code so the CLI wrapper can forward it to `process.exit`.
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
  const { client, mode, connection } = await createDetectedClient(apiKey);

  if (!connection.ok) {
    process.stdout.write(`${renderReport({ ok: false, mode, results: [connection] })}\n`);
    return 1;
  }

  if (mode === "live" && !(await confirmLiveModeRun())) {
    process.stderr.write(renderCancelMessage());
    return 130;
  }

  const storeIds = connection.resource?.storeIds ?? [];
  if (storeIds.length === 0) {
    process.stdout.write(
      chalk.yellow(
        "No stores reachable with this key. Create a store in Lemon Squeezy and retry.\n",
      ),
    );
    return 1;
  }

  process.stdout.write(renderDetected("Stores", String(storeIds.length), "Lemon Squeezy API"));
  const stores = await Promise.all(storeIds.map((id) => client.validateStore(id)));
  const pickable = stores
    .filter((entry) => entry.ok && entry.resource)
    .map((entry, index) => ({
      id: storeIds[index] ?? "",
      name: entry.resource?.name ?? "(unnamed)",
      slug: entry.resource?.slug ?? "",
    }))
    .filter((entry) => entry.id !== "");

  if (pickable.length === 0) {
    process.stdout.write(
      chalk.yellow(
        "Stores were discovered, but none could be validated. Check account access and retry.\n",
      ),
    );
    return 1;
  }

  process.stdout.write(renderStep(3, 5, "Store selection", "auto-select when unambiguous"));
  const storeId = await resolveStoreSelection(pickable);

  process.stdout.write(renderStep(4, 5, "Optional checks", "pick resources before manual IDs"));
  const selectedTargets = await selectDoctorTargets();
  const resourceChoices = await discoverChoices(client, storeId, selectedTargets);
  process.stdout.write(renderDiscoverySummary(resourceChoices, selectedTargets));
  const doctorTargets = await askForDoctorTargetValues(selectedTargets, resourceChoices);

  const envPath = path.resolve(process.cwd(), options.envFile ?? ".env");
  const checkNames = getDoctorCheckNames(doctorTargets);
  process.stdout.write(renderSetupSummary({ envPath, mode, storeId, checkNames }));
  const shouldWrite = await confirmWriteEnvFile(envPath);
  if (shouldWrite) {
    await writeEnvFile(envPath, { apiKey, mode, storeId });
    process.stdout.write(chalk.green(`Wrote ${envPath}\n`));
  }

  process.stdout.write(chalk.dim(`\nRunning doctor (${checkNames.join(", ")})...\n\n`));
  const report = await client.doctor({ storeId, ...doctorTargets });
  process.stdout.write(`${renderReport(report)}\n`);

  return report.ok ? 0 : 1;
};

const resolveStoreSelection = async (
  pickable: Array<{ id: string; name: string; slug: string }>,
): Promise<string> => {
  if (pickable.length === 1) {
    const store = pickable[0];
    if (!store) throw new Error("Expected one reachable store.");
    process.stdout.write(
      renderDetected("Store", `${store.name} (${store.slug})`, `id ${store.id}`),
    );
    return store.id;
  }

  return pickStore(pickable);
};

const discoverChoices = async (
  client: FreshSqueezyClient,
  storeId: string,
  selectedTargets: InitDoctorTarget[],
): Promise<InitResourceChoices> => {
  if (selectedTargets.length === 0) return EMPTY_INIT_RESOURCE_CHOICES;
  return discoverInitResourceChoices(client, storeId, selectedTargets);
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

const createDetectedClient = async (
  apiKey: string,
): Promise<{
  client: FreshSqueezyClient;
  mode: Mode;
  connection: ValidationResult<ConnectionSummary>;
}> => {
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
    return { client, mode: actualMode, connection };
  }

  if (actualMode) {
    process.stdout.write(chalk.dim(`Detected ${actualMode}-mode API key.\n`));
    return { client, mode: actualMode, connection };
  }

  if (envMode) {
    process.stdout.write(
      chalk.dim(`Using ${ENV_KEYS.mode}=${envMode}; API mode was not exposed.\n`),
    );
    return { client, mode: envMode, connection };
  }

  process.stdout.write(chalk.dim("Could not auto-detect key mode; using test mode.\n"));
  return { client, mode: initialMode, connection };
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

const getDoctorCheckNames = (targets: InitDoctorTargets): string[] => {
  const names = ["connection", "store"];
  pushCheckName(names, "product", targets.productIds);
  pushCheckName(names, "webhook", targets.webhookUrls);
  pushCheckName(names, "discount", targets.discountIds);
  pushCheckName(names, "licenseKey", targets.licenseKeyIds);
  pushCheckName(names, "subscriptionPlan", targets.variantIds);
  return names;
};

const pushCheckName = (names: string[], name: string, values: string[] | undefined): void => {
  if (!values || values.length === 0) return;
  names.push(values.length === 1 ? name : `${name} x${values.length}`);
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
  choices: InitResourceChoices,
  selectedTargets: InitDoctorTarget[],
): string => {
  if (selectedTargets.length === 0) return chalk.dim("  No optional resource checks selected.\n");

  const groups: Array<[InitDoctorTarget, string, ResourceChoiceGroup]> = [
    ["product", "Products", choices.products],
    ["webhook", "Webhooks", choices.webhooks],
    ["discount", "Discounts", choices.discounts],
    ["license-key", "License keys", choices.licenseKeys],
    ["subscription-plan", "Subscription plans", choices.subscriptionPlans],
  ];

  const lines: string[] = [];
  for (const [target, label, group] of groups) {
    if (!selectedTargets.includes(target)) continue;
    if (group.error) {
      lines.push(chalk.yellow(`  ! ${label} discovery failed; manual entry is available.`));
    } else {
      lines.push(
        renderDetected(label, String(group.choices.length), "Lemon Squeezy API").trimEnd(),
      );
    }
  }

  return `${lines.join("\n")}\n`;
};
