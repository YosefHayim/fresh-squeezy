import path from "node:path";
import inquirer from "inquirer";
import {
  EMPTY_INIT_RESOURCE_CHOICES,
  type InitResourceChoices,
  type ResourceChoiceGroup,
} from "./resourceDiscovery.js";

/**
 * Interactive prompts used by `fresh-squeezy init`.
 *
 * Isolated from the command handler so the command stays focused on the flow
 * (ask → detect → confirm → write) and prompts can be unit-tested by mocking
 * inquirer without pulling in the full commander program.
 */

export interface InitAnswers {
  apiKey: string;
}

export interface InitDoctorTargets {
  productIds?: string[];
  webhookUrls?: string[];
  discountIds?: string[];
  licenseKeyIds?: string[];
  variantIds?: string[];
}

export type InitDoctorTarget = "product" | "webhook" | "discount" | "license-key" | "subscription-plan";
export type LauncherAction = "init" | "doctor" | "examples" | "exit";

type DoctorTargetField = keyof InitDoctorTargets;
type InitDoctorAnswers = Partial<Record<DoctorTargetField, string[] | string>>;
type ManualQuestion = {
  type: "input";
  name: DoctorTargetField;
  message: string;
  theme: typeof PROMPT_THEME;
  validate: (value: string) => true | string;
};
type EmptyTargetAction = "manual" | "skip";

const PROMPT_THEME = {
  prefix: {
    idle: "›",
    done: "✓",
  },
} as const;

export async function pickLauncherAction(): Promise<LauncherAction> {
  const { action } = await inquirer.prompt<{ action: LauncherAction }>([
    {
      type: "list",
      name: "action",
      message: "What do you want to do?",
      theme: PROMPT_THEME,
      choices: [
        {
          name: "Start guided setup — key, store, checks, doctor",
          value: "init",
        },
        {
          name: "Run doctor now — pick stores interactively when needed",
          value: "doctor",
        },
        {
          name: "Show command examples — copy/paste friendly",
          value: "examples",
        },
        {
          name: "Exit",
          value: "exit",
        },
      ],
    },
  ]);
  return action;
}

export async function askForApiKey(): Promise<InitAnswers> {
  const answers = await inquirer.prompt<InitAnswers>([
    {
      type: "password",
      name: "apiKey",
      message: "Paste your Lemon Squeezy API key:",
      mask: "",
      theme: PROMPT_THEME,
      validate: (value: string) => (value.trim().length > 0 ? true : "API key is required."),
    },
  ]);
  return { apiKey: answers.apiKey.trim() };
}

export async function pickStore(
  choices: { id: string; name: string; slug: string }[]
): Promise<string> {
  const { storeId } = await inquirer.prompt<{ storeId: string }>([
    {
      type: "list",
      name: "storeId",
      message: "Pick a store to validate against:",
      theme: PROMPT_THEME,
      choices: choices.map((entry) => ({
        name: `${entry.name} (${entry.slug}) — id ${entry.id}`,
        value: entry.id,
      })),
    },
  ]);
  return storeId;
}

/**
 * Multi-select store picker used by `doctor` and `validate` when no
 * `--store-ids` / `--all-stores` flag is supplied and stdin is a TTY.
 * The first store is pre-checked so hitting Enter without toggling still
 * picks something — callers enforce the "at least one" rule.
 */
export async function pickStores(
  choices: { id: string; name: string; slug: string }[]
): Promise<string[]> {
  const { storeIds } = await inquirer.prompt<{ storeIds: string[] }>([
    {
      type: "checkbox",
      name: "storeIds",
      message: "Pick one or more stores (space to toggle, enter to confirm):",
      theme: PROMPT_THEME,
      choices: choices.map((entry, index) => ({
        name: `${entry.name} (${entry.slug}) — id ${entry.id}`,
        value: entry.id,
        checked: index === 0,
      })),
      validate: (values: unknown) =>
        Array.isArray(values) && values.length > 0 ? true : "Pick at least one store.",
    },
  ]);
  return storeIds;
}

export async function selectDoctorTargets(): Promise<InitDoctorTarget[]> {
  const { targets } = await inquirer.prompt<{ targets: InitDoctorTarget[] }>([
    {
      type: "checkbox",
      name: "targets",
      message: "Add resource checks to this doctor run?",
      theme: PROMPT_THEME,
      choices: [
        { name: "Product checkout", value: "product" },
        { name: "Webhook registration", value: "webhook" },
        { name: "Discount code", value: "discount" },
        { name: "License key", value: "license-key" },
        { name: "Subscription plan", value: "subscription-plan" },
      ],
    },
  ]);

  return targets;
}

export async function askForDoctorTargetValues(
  targets: InitDoctorTarget[],
  choices: InitResourceChoices = EMPTY_INIT_RESOURCE_CHOICES
): Promise<InitDoctorTargets> {
  if (targets.length === 0) return {};

  const answers: InitDoctorAnswers = {};
  const manualQuestions: ManualQuestion[] = [];

  if (targets.includes("product")) {
    await resolveTargetValue({
      answers,
      manualQuestions,
      group: choices.products,
      field: "productIds",
      pickMessage: "Pick products to validate:",
      emptyMessage: "No products selected. What now?",
      manualMessage: "Product IDs to validate (comma-separated, leave empty to skip):",
      validate: optional("Product ID"),
    });
  }

  if (targets.includes("webhook")) {
    await resolveTargetValue({
      answers,
      manualQuestions,
      group: choices.webhooks,
      field: "webhookUrls",
      pickMessage: "Pick webhook URLs to validate:",
      emptyMessage: "No webhook URLs selected. What now?",
      manualMessage: "Webhook URLs to validate (comma-separated, leave empty to skip):",
      validate: optionalWebhookUrls,
    });
  }

  if (targets.includes("discount")) {
    await resolveTargetValue({
      answers,
      manualQuestions,
      group: choices.discounts,
      field: "discountIds",
      pickMessage: "Pick discounts to validate:",
      emptyMessage: "No discounts selected. What now?",
      manualMessage: "Discount IDs to validate (comma-separated, leave empty to skip):",
      validate: optional("Discount ID"),
    });
  }

  if (targets.includes("license-key")) {
    await resolveTargetValue({
      answers,
      manualQuestions,
      group: choices.licenseKeys,
      field: "licenseKeyIds",
      pickMessage: "Pick license keys to validate:",
      emptyMessage: "No license keys selected. What now?",
      manualMessage: "License key IDs to validate (comma-separated, leave empty to skip):",
      validate: optional("License key ID"),
    });
  }

  if (targets.includes("subscription-plan")) {
    await resolveTargetValue({
      answers,
      manualQuestions,
      group: choices.subscriptionPlans,
      field: "variantIds",
      pickMessage: "Pick subscription plans to validate:",
      emptyMessage: "No subscription plans selected. What now?",
      manualMessage: "Subscription plan variant IDs to validate (comma-separated, leave empty to skip):",
      validate: optional("Variant ID"),
    });
  }

  if (manualQuestions.length > 0) {
    const manualAnswers = await inquirer.prompt<InitDoctorAnswers>(manualQuestions);
    Object.assign(answers, manualAnswers);
  }

  return {
    productIds: cleanList(answers.productIds),
    webhookUrls: cleanList(answers.webhookUrls),
    discountIds: cleanList(answers.discountIds),
    licenseKeyIds: cleanList(answers.licenseKeyIds),
    variantIds: cleanList(answers.variantIds),
  };
}

export async function confirmLiveModeRun(): Promise<boolean> {
  const { continueLive } = await inquirer.prompt<{ continueLive: boolean }>([
    {
      type: "confirm",
      name: "continueLive",
      message: "This is a live-mode key. Continue with live checks?",
      default: false,
      theme: PROMPT_THEME,
    },
  ]);
  return continueLive;
}

export async function confirmWriteEnvFile(filePath: string): Promise<boolean> {
  const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
    {
      type: "confirm",
      name: "confirm",
      message: `Write these values to ${formatPromptPath(filePath)}?`,
      default: true,
      theme: PROMPT_THEME,
    },
  ]);
  return confirm;
}

async function resolveTargetValue(input: {
  answers: InitDoctorAnswers;
  manualQuestions: ManualQuestion[];
  group: ResourceChoiceGroup;
  field: DoctorTargetField;
  pickMessage: string;
  emptyMessage: string;
  manualMessage: string;
  validate: (value: string) => true | string;
}): Promise<void> {
  if (input.group.choices.length === 0) {
    input.manualQuestions.push({
      type: "input",
      name: input.field,
      message: input.manualMessage,
      theme: PROMPT_THEME,
      validate: input.validate,
    });
    return;
  }

  const { values } = await inquirer.prompt<{ values: string[] }>([
    {
      type: "checkbox",
      name: "values",
      message: input.pickMessage,
      theme: PROMPT_THEME,
      choices: input.group.choices.map((choice) => ({
        name: choice.label,
        value: choice.value,
      })),
    },
  ]);

  if (values.length > 0) {
    input.answers[input.field] = values;
    return;
  }

  const action = await askEmptyTargetAction(input.emptyMessage);
  if (action === "manual") {
    input.manualQuestions.push({
      type: "input",
      name: input.field,
      message: input.manualMessage,
      theme: PROMPT_THEME,
      validate: input.validate,
    });
  }
}

async function askEmptyTargetAction(message: string): Promise<EmptyTargetAction> {
  const { action } = await inquirer.prompt<{ action: EmptyTargetAction }>([
    {
      type: "list",
      name: "action",
      message,
      theme: PROMPT_THEME,
      choices: [
        { name: "Enter manually", value: "manual" },
        { name: "Skip this check", value: "skip" },
      ],
    },
  ]);
  return action;
}

function required(label: string): (value: string) => true | string {
  return (value: string) => (value.trim().length > 0 ? true : `${label} is required.`);
}

function optional(label: string): (value: string) => true | string {
  return (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length === 0) return true;
    return required(label)(trimmed);
  };
}

function validateWebhookUrl(value: string): true | string {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "Webhook URL is required.";

  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:"
      ? true
      : "Webhook URL must start with http:// or https://.";
  } catch {
    return "Enter a valid webhook URL.";
  }
}

function optionalWebhookUrls(value: string): true | string {
  const values = splitManualValues(value);
  if (values.length === 0) return true;
  return values.every((entry) => validateWebhookUrl(entry) === true)
    ? true
    : "Enter valid webhook URLs.";
}

function cleanList(value: string[] | string | undefined): string[] | undefined {
  const values = Array.isArray(value) ? value : splitManualValues(value);
  const cleanValues = Array.from(new Set(values.map((entry) => entry.trim()).filter(Boolean)));
  return cleanValues.length > 0 ? cleanValues : undefined;
}

function splitManualValues(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function formatPromptPath(filePath: string): string {
  const relative = path.relative(process.cwd(), filePath);
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) return relative;
  return path.basename(filePath);
}

export function isPromptCancel(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === "ExitPromptError" || error.message.includes("User force closed");
}
