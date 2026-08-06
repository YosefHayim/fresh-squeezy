import path from "node:path";
import { checkbox, confirm, input, password, select } from "@inquirer/prompts";
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
 * `@inquirer/prompts` without pulling in the full commander program.
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

export type InitDoctorTarget =
  | "product"
  | "webhook"
  | "discount"
  | "license-key"
  | "subscription-plan";
export type LauncherAction = "init" | "doctor" | "examples" | "exit";

type DoctorTargetField = keyof InitDoctorTargets;
type ManualQuestion = {
  field: DoctorTargetField;
  message: string;
  validate: (value: string) => true | string;
};
type EmptyTargetAction = "manual" | "skip";

const PROMPT_THEME = {
  prefix: {
    idle: "›",
    done: "✓",
  },
} as const;

export const pickLauncherAction = async (): Promise<LauncherAction> => {
  return select<LauncherAction>({
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
  });
};

export const askForApiKey = async (): Promise<InitAnswers> => {
  const apiKey = await password({
    message: "Paste your Lemon Squeezy API key:",
    mask: false,
    theme: PROMPT_THEME,
    validate: (value: string) => (value.trim().length > 0 ? true : "API key is required."),
  });
  return { apiKey: apiKey.trim() };
};

export const pickStore = async (
  choices: { id: string; name: string; slug: string }[],
): Promise<string> => {
  return select<string>({
    message: "Pick a store to validate against:",
    theme: PROMPT_THEME,
    choices: choices.map((entry) => ({
      name: `${entry.name} (${entry.slug}) — id ${entry.id}`,
      value: entry.id,
    })),
  });
};

/**
 * Multi-select store picker used by `doctor` and `validate` when no
 * `--store-ids` / `--all-stores` flag is supplied and stdin is a TTY.
 * The first store is pre-checked so hitting Enter without toggling still
 * picks something — callers enforce the "at least one" rule.
 */
export const pickStores = async (
  choices: { id: string; name: string; slug: string }[],
): Promise<string[]> => {
  return checkbox<string>({
    message: "Pick one or more stores (space to toggle, enter to confirm):",
    theme: PROMPT_THEME,
    choices: choices.map((entry, index) => ({
      name: `${entry.name} (${entry.slug}) — id ${entry.id}`,
      value: entry.id,
      checked: index === 0,
    })),
    validate: (selected) => (selected.length > 0 ? true : "Pick at least one store."),
  });
};

export const selectDoctorTargets = async (): Promise<InitDoctorTarget[]> => {
  return checkbox<InitDoctorTarget>({
    message: "Add resource checks to this doctor run?",
    theme: PROMPT_THEME,
    choices: [
      { name: "Product checkout", value: "product" },
      { name: "Webhook registration", value: "webhook" },
      { name: "Discount code", value: "discount" },
      { name: "License key", value: "license-key" },
      { name: "Subscription plan", value: "subscription-plan" },
    ],
  });
};

const splitManualValues = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const required = (label: string): ((value: string) => true | string) => {
  return (value: string) => (value.trim().length > 0 ? true : `${label} is required.`);
};

const optional = (label: string): ((value: string) => true | string) => {
  return (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length === 0) return true;
    return required(label)(trimmed);
  };
};

const validateWebhookUrl = (value: string): true | string => {
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
};

const optionalWebhookUrls = (value: string): true | string => {
  const values = splitManualValues(value);
  if (values.length === 0) return true;
  return values.every((entry) => validateWebhookUrl(entry) === true)
    ? true
    : "Enter valid webhook URLs.";
};

const cleanList = (value: string[] | string | undefined): string[] | undefined => {
  const values = Array.isArray(value) ? value : splitManualValues(value);
  const cleaned = Array.from(new Set(values.map((entry) => entry.trim()).filter(Boolean)));
  return cleaned.length > 0 ? cleaned : undefined;
};

const DOCTOR_TARGET_SPECS: Array<{
  target: InitDoctorTarget;
  field: DoctorTargetField;
  group: keyof InitResourceChoices;
  pickMessage: string;
  emptyMessage: string;
  manualMessage: string;
  validate: (value: string) => true | string;
}> = [
  {
    target: "product",
    field: "productIds",
    group: "products",
    pickMessage: "Pick products to validate:",
    emptyMessage: "No products selected. What now?",
    manualMessage: "Product IDs to validate (comma-separated, leave empty to skip):",
    validate: optional("Product ID"),
  },
  {
    target: "webhook",
    field: "webhookUrls",
    group: "webhooks",
    pickMessage: "Pick webhook URLs to validate:",
    emptyMessage: "No webhook URLs selected. What now?",
    manualMessage: "Webhook URLs to validate (comma-separated, leave empty to skip):",
    validate: optionalWebhookUrls,
  },
  {
    target: "discount",
    field: "discountIds",
    group: "discounts",
    pickMessage: "Pick discounts to validate:",
    emptyMessage: "No discounts selected. What now?",
    manualMessage: "Discount IDs to validate (comma-separated, leave empty to skip):",
    validate: optional("Discount ID"),
  },
  {
    target: "license-key",
    field: "licenseKeyIds",
    group: "licenseKeys",
    pickMessage: "Pick license keys to validate:",
    emptyMessage: "No license keys selected. What now?",
    manualMessage: "License key IDs to validate (comma-separated, leave empty to skip):",
    validate: optional("License key ID"),
  },
  {
    target: "subscription-plan",
    field: "variantIds",
    group: "subscriptionPlans",
    pickMessage: "Pick subscription plans to validate:",
    emptyMessage: "No subscription plans selected. What now?",
    manualMessage:
      "Subscription plan variant IDs to validate (comma-separated, leave empty to skip):",
    validate: optional("Variant ID"),
  },
];

export const askForDoctorTargetValues = async (
  targets: InitDoctorTarget[],
  choices: InitResourceChoices = EMPTY_INIT_RESOURCE_CHOICES,
): Promise<InitDoctorTargets> => {
  if (targets.length === 0) return {};

  const answers: Partial<Record<DoctorTargetField, string[] | string>> = {};
  const manualQuestions: ManualQuestion[] = [];

  for (const spec of DOCTOR_TARGET_SPECS) {
    if (!targets.includes(spec.target)) continue;
    await resolveTargetValue({
      answers,
      manualQuestions,
      group: choices[spec.group],
      field: spec.field,
      pickMessage: spec.pickMessage,
      emptyMessage: spec.emptyMessage,
      manualMessage: spec.manualMessage,
      validate: spec.validate,
    });
  }

  for (const question of manualQuestions) {
    answers[question.field] = await input({
      message: question.message,
      theme: PROMPT_THEME,
      validate: question.validate,
    });
  }

  return {
    productIds: cleanList(answers.productIds),
    webhookUrls: cleanList(answers.webhookUrls),
    discountIds: cleanList(answers.discountIds),
    licenseKeyIds: cleanList(answers.licenseKeyIds),
    variantIds: cleanList(answers.variantIds),
  };
};

export const confirmLiveModeRun = async (): Promise<boolean> => {
  return confirm({
    message: "This is a live-mode key. Continue with live checks?",
    default: false,
    theme: PROMPT_THEME,
  });
};

export const confirmWriteEnvFile = async (filePath: string): Promise<boolean> => {
  return confirm({
    message: `Write these values to ${formatPromptPath(filePath)}?`,
    default: true,
    theme: PROMPT_THEME,
  });
};

/**
 * Confirm a destructive or live-mode resource op before mutating.
 *
 * @param message - Prompt shown to the operator.
 * @returns Whether the user confirmed.
 *
 * @example
 * ```ts
 * const ok = await confirmResourceOp("Delete webhook 12?");
 * ```
 */
export const confirmResourceOp = async (message: string): Promise<boolean> => {
  return confirm({
    message,
    default: false,
    theme: PROMPT_THEME,
  });
};

const resolveTargetValue = async (input: {
  answers: Partial<Record<DoctorTargetField, string[] | string>>;
  manualQuestions: ManualQuestion[];
  group: ResourceChoiceGroup;
  field: DoctorTargetField;
  pickMessage: string;
  emptyMessage: string;
  manualMessage: string;
  validate: (value: string) => true | string;
}): Promise<void> => {
  if (input.group.choices.length === 0) {
    input.manualQuestions.push({
      field: input.field,
      message: input.manualMessage,
      validate: input.validate,
    });
    return;
  }

  const values = await checkbox<string>({
    message: input.pickMessage,
    theme: PROMPT_THEME,
    choices: input.group.choices.map((choice) => ({
      name: choice.label,
      value: choice.value,
    })),
  });

  if (values.length > 0) {
    input.answers[input.field] = values;
    return;
  }

  const action = await askEmptyTargetAction(input.emptyMessage);
  if (action === "manual") {
    input.manualQuestions.push({
      field: input.field,
      message: input.manualMessage,
      validate: input.validate,
    });
  }
};

const askEmptyTargetAction = async (message: string): Promise<EmptyTargetAction> => {
  return select<EmptyTargetAction>({
    message,
    theme: PROMPT_THEME,
    choices: [
      { name: "Enter manually", value: "manual" },
      { name: "Skip this check", value: "skip" },
    ],
  });
};

const formatPromptPath = (filePath: string): string => {
  const relative = path.relative(process.cwd(), filePath);
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) return relative;
  return path.basename(filePath);
};

export const isPromptCancel = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  return error.name === "ExitPromptError" || error.message.includes("User force closed");
};
