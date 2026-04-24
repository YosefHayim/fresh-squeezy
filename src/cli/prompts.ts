import inquirer from "inquirer";
import type { Mode } from "../core/types.js";

/**
 * Interactive prompts used by `fresh-squeezy init`.
 *
 * Isolated from the command handler so the command stays focused on the flow
 * (ask → detect → confirm → write) and prompts can be unit-tested by mocking
 * inquirer without pulling in the full commander program.
 */

export interface InitAnswers {
  apiKey: string;
  mode: Mode;
}

export async function askForCredentials(): Promise<InitAnswers> {
  const answers = await inquirer.prompt<InitAnswers>([
    {
      type: "password",
      name: "apiKey",
      message: "Paste your Lemon Squeezy API key:",
      mask: "*",
      validate: (value: string) => (value.trim().length > 0 ? true : "API key is required."),
    },
    {
      type: "list",
      name: "mode",
      message: "Which mode does this key belong to?",
      choices: [
        { name: "test — sandbox / development", value: "test" },
        { name: "live — production charges", value: "live" },
      ],
      default: "test",
    },
  ]);
  return answers;
}

export async function pickStore(
  choices: { id: string; name: string; slug: string }[]
): Promise<string> {
  const { storeId } = await inquirer.prompt<{ storeId: string }>([
    {
      type: "list",
      name: "storeId",
      message: "Pick a store to validate against:",
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

export async function confirmWriteEnvFile(path: string): Promise<boolean> {
  const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
    {
      type: "confirm",
      name: "confirm",
      message: `Write these values to ${path}?`,
      default: true,
    },
  ]);
  return confirm;
}
