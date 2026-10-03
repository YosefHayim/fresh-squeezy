import path from "node:path";
import { checkbox, confirm, input, password, select } from "@inquirer/prompts";
import {
  type DiscoveredChoices,
  OPTIONAL_VALIDATORS,
  type OptionalValidator,
  type OptionalValidatorIds,
  type OptionalValidatorName,
  type ResourceChoiceGroup,
} from "./optionalValidators.js";

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

export type LauncherAction = "init" | "doctor" | "manage" | "examples" | "exit";

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
        name: "Manage resources — bulk delete / cancel / refund",
        value: "manage",
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

export const selectOptionalValidators = async (): Promise<OptionalValidatorName[]> => {
  return checkbox<OptionalValidatorName>({
    message: "Add resource checks to this doctor run?",
    theme: PROMPT_THEME,
    choices: OPTIONAL_VALIDATORS.map((row) => ({ name: row.menuLabel, value: row.name })),
  });
};

const splitManualValues = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const cleanList = (value: string[] | string | undefined): string[] | undefined => {
  const values = Array.isArray(value) ? value : splitManualValues(value);
  const cleaned = Array.from(new Set(values.map((entry) => entry.trim()).filter(Boolean)));
  return cleaned.length > 0 ? cleaned : undefined;
};

const pickDiscoveredIds = async (
  row: OptionalValidator,
  group: ResourceChoiceGroup | undefined,
): Promise<string[] | EmptyTargetAction> => {
  const discovered = group?.choices ?? [];
  if (discovered.length === 0) return "manual";

  const values = await checkbox<string>({
    message: `Pick ${row.noun} to validate:`,
    theme: PROMPT_THEME,
    choices: discovered.map((choice) => ({ name: choice.label, value: choice.value })),
  });
  if (values.length > 0) return values;
  return askEmptyTargetAction(`No ${row.noun} selected. What now?`);
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

export const askForValidatorIds = async (
  names: OptionalValidatorName[],
  choices: DiscoveredChoices = {},
): Promise<OptionalValidatorIds> => {
  if (names.length === 0) return {};

  const answers: Partial<Record<keyof OptionalValidatorIds, string[] | string>> = {};
  const manualRows: OptionalValidator[] = [];

  for (const row of OPTIONAL_VALIDATORS) {
    if (!names.includes(row.name)) continue;
    const picked = await pickDiscoveredIds(row, choices[row.name]);
    if (picked === "manual") manualRows.push(row);
    else if (picked !== "skip") answers[row.field] = picked;
  }

  for (const row of manualRows) {
    answers[row.field] = await input({
      message: `${row.manualNoun} to validate (comma-separated, leave empty to skip):`,
      theme: PROMPT_THEME,
      validate: row.validate,
    });
  }

  const targetValues: OptionalValidatorIds = {};
  for (const row of OPTIONAL_VALIDATORS) targetValues[row.field] = cleanList(answers[row.field]);
  return targetValues;
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

const formatPromptPath = (filePath: string): string => {
  const relative = path.relative(process.cwd(), filePath);
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) return relative;
  return path.basename(filePath);
};

export const isPromptCancel = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  return error.name === "ExitPromptError";
};

/** One bulk-capable operation offered by the "Manage resources" menu. */
export interface ManageOperationChoice {
  resource: string;
  verb: string;
}

/**
 * Pick which destructive op to run (e.g. `delete discount`).
 *
 * @param ops - Registry-backed operations that can run in bulk.
 * @returns The chosen operation.
 */
export const pickManageOperation = async (
  ops: ManageOperationChoice[],
): Promise<ManageOperationChoice> => {
  return select<ManageOperationChoice>({
    message: "Which operation?",
    theme: PROMPT_THEME,
    choices: ops.map((op) => ({ name: `${op.verb} ${op.resource}`, value: op })),
  });
};

/**
 * Ask for the parent resource id that scopes a nested list (order, subscription, …).
 *
 * @param resource - Resource being listed, used in the prompt text.
 */
export const askParentId = async (resource: string): Promise<string> => {
  const value = await input({
    message: `Parent id to list ${resource} items from:`,
    theme: PROMPT_THEME,
    validate: (entry: string) => (entry.trim().length > 0 ? true : "A parent id is required."),
  });
  return value.trim();
};

/**
 * Multi-select the items to act on. Nothing is pre-checked so a stray Enter
 * cannot select everything; `a` toggles all.
 *
 * @param verb - Verb shown in the prompt.
 * @param items - Candidate items with a display label.
 * @returns Ids of the picked items.
 */
export const pickBulkTargets = async (
  verb: string,
  items: { id: string; label: string }[],
): Promise<string[]> => {
  return checkbox<string>({
    message: `Pick items to ${verb} (space toggles, a selects all, enter confirms):`,
    theme: PROMPT_THEME,
    choices: items.map((item) => ({ name: `${item.label} — id ${item.id}`, value: item.id })),
    validate: (selected) => (selected.length > 0 ? true : "Pick at least one item."),
  });
};
