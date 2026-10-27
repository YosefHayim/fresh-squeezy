import path from "node:path";
import { checkbox, confirm, input, password, select } from "@inquirer/prompts";
import { splitCsv, uniqueValues } from "./csv-values.js";
import {
	type DiscoveredChoices,
	OPTIONAL_VALIDATORS,
	type OptionalValidator,
	type OptionalValidatorIds,
	type OptionalValidatorName,
	type ResourceChoiceGroup,
} from "./optional-validators.js";
import type { StoreChoice } from "./resolve-stores.js";

export type LauncherAction = "init" | "doctor" | "manage" | "examples" | "exit";

type EmptyTargetAction = "manual" | "skip";

const PROMPT_THEME = {
	prefix: {
		idle: "›",
		done: "✓",
	},
} as const;

export const pickLauncherAction = (): Promise<LauncherAction> =>
	select<LauncherAction>({
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

export const askForApiKey = async (): Promise<string> => {
	const apiKey = await password({
		message: "Paste your Lemon Squeezy API key:",
		mask: false,
		theme: PROMPT_THEME,
		validate: (value: string) => {
			const isApiKeyGiven = value.trim().length > 0;
			return isApiKeyGiven ? true : "API key is required.";
		},
	});
	return apiKey.trim();
};

const storeChoiceLabel = (store: StoreChoice): string =>
	`${store.name} (${store.slug}) — id ${store.id}`;

export const pickStore = (choices: StoreChoice[]): Promise<string> =>
	select<string>({
		message: "Pick a store to validate against:",
		theme: PROMPT_THEME,
		choices: choices.map((store) => ({
			name: storeChoiceLabel(store),
			value: store.id,
		})),
	});

export const pickStores = (choices: StoreChoice[]): Promise<string[]> =>
	checkbox<string>({
		message: "Pick one or more stores (space to toggle, enter to confirm):",
		theme: PROMPT_THEME,
		choices: choices.map((store, index) => ({
			name: storeChoiceLabel(store),
			value: store.id,
			checked: index === 0,
		})),
		validate: (selected) => {
			const isAnyStoreSelected = selected.length > 0;
			return isAnyStoreSelected ? true : "Pick at least one store.";
		},
	});

export const selectOptionalValidators = (): Promise<OptionalValidatorName[]> =>
	checkbox<OptionalValidatorName>({
		message: "Add resource checks to this doctor run?",
		theme: PROMPT_THEME,
		choices: OPTIONAL_VALIDATORS.map((optionalValidator) => ({
			name: optionalValidator.menuLabel,
			value: optionalValidator.name,
		})),
	});

const cleanList = (
	value: string[] | string | undefined,
): string[] | undefined => {
	const isAlreadyList = Array.isArray(value);
	const values = isAlreadyList ? value : splitCsv(value ?? "");
	const cleaned = uniqueValues(values);
	const isAnyValueLeft = cleaned.length > 0;
	return isAnyValueLeft ? cleaned : undefined;
};

const pickDiscoveredIds = async (
	optionalValidator: OptionalValidator,
	group: ResourceChoiceGroup | undefined,
): Promise<string[] | EmptyTargetAction> => {
	const discovered = group?.choices ?? [];
	const isNothingDiscovered = discovered.length === 0;
	if (isNothingDiscovered) return "manual";

	const values = await checkbox<string>({
		message: `Pick ${optionalValidator.noun} to validate:`,
		theme: PROMPT_THEME,
		choices: discovered.map((choice) => ({
			name: choice.label,
			value: choice.value,
		})),
	});
	const isAnyIdPicked = values.length > 0;
	if (isAnyIdPicked) return values;
	return select<EmptyTargetAction>({
		message: `No ${optionalValidator.noun} selected. What now?`,
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
	const areNoValidatorsChosen = names.length === 0;
	if (areNoValidatorsChosen) return {};

	const answers: Partial<
		Record<keyof OptionalValidatorIds, string[] | string>
	> = {};
	const manualRows: OptionalValidator[] = [];

	for (const optionalValidator of OPTIONAL_VALIDATORS) {
		const isValidatorNotChosen = !names.includes(optionalValidator.name);
		if (isValidatorNotChosen) continue;
		const picked = await pickDiscoveredIds(
			optionalValidator,
			choices[optionalValidator.name],
		);
		const isManualEntryWanted = picked === "manual";
		const arePickedIdsGiven = Array.isArray(picked);
		if (isManualEntryWanted) manualRows.push(optionalValidator);
		if (arePickedIdsGiven) answers[optionalValidator.field] = picked;
	}

	for (const optionalValidator of manualRows) {
		answers[optionalValidator.field] = await input({
			message: `${optionalValidator.manualNoun} to validate (comma-separated, leave empty to skip):`,
			theme: PROMPT_THEME,
			validate: optionalValidator.validate,
		});
	}

	const targetValues: OptionalValidatorIds = {};
	for (const optionalValidator of OPTIONAL_VALIDATORS)
		targetValues[optionalValidator.field] = cleanList(
			answers[optionalValidator.field],
		);
	return targetValues;
};

export const confirmLiveModeRun = (): Promise<boolean> =>
	confirm({
		message: "This is a live-mode key. Continue with live checks?",
		default: false,
		theme: PROMPT_THEME,
	});

const formatPromptPath = (filePath: string): string => {
	const workingDir = process.cwd();
	const relative = path.relative(workingDir, filePath);
	const isInsideWorkingDir =
		relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
	if (isInsideWorkingDir) return relative;
	return path.basename(filePath);
};

export const confirmWriteEnvFile = (filePath: string): Promise<boolean> =>
	confirm({
		message: `Write these values to ${formatPromptPath(filePath)}?`,
		default: true,
		theme: PROMPT_THEME,
	});

export const confirmResourceOp = (message: string): Promise<boolean> =>
	confirm({
		message,
		default: false,
		theme: PROMPT_THEME,
	});

export const isPromptCancel = (error: unknown): boolean => {
	const isNotError = !(error instanceof Error);
	if (isNotError) return false;
	return error.name === "ExitPromptError";
};

export interface ManageOperationChoice {
	resource: string;
	verb: string;
}

export const pickManageOperation = (
	ops: ManageOperationChoice[],
): Promise<ManageOperationChoice> =>
	select<ManageOperationChoice>({
		message: "Which operation?",
		theme: PROMPT_THEME,
		choices: ops.map((op) => ({
			name: `${op.verb} ${op.resource}`,
			value: op,
		})),
	});

export const askParentId = async (resource: string): Promise<string> => {
	const parentId = await input({
		message: `Parent id to list ${resource} items from:`,
		theme: PROMPT_THEME,
		validate: (entry: string) => {
			const isParentIdGiven = entry.trim().length > 0;
			return isParentIdGiven ? true : "A parent id is required.";
		},
	});
	return parentId.trim();
};

export const pickBulkTargets = (
	verb: string,
	items: { id: string; label: string }[],
): Promise<string[]> =>
	checkbox<string>({
		message: `Pick items to ${verb} (space toggles, a selects all, enter confirms):`,
		theme: PROMPT_THEME,
		choices: items.map((item) => ({
			name: `${item.label} — id ${item.id}`,
			value: item.id,
		})),
		validate: (selected) => {
			const isAnyItemSelected = selected.length > 0;
			return isAnyItemSelected ? true : "Pick at least one item.";
		},
	});
