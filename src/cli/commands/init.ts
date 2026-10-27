import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import { ENV_KEYS, readEnvApiKey, readEnvMode } from "@/shared/config.js";
import type { Mode, ValidationResult } from "@/contracts/contracts.js";
import {
	type FreshSqueezyClient,
	createFreshSqueezy,
} from "@/create-fresh-squeezy.js";
import type { ConnectionSummary } from "@/validate/connection.js";
import {
	type DiscoveredChoices,
	OPTIONAL_VALIDATORS,
	type OptionalValidatorIds,
	type OptionalValidatorName,
	discoverChoices,
} from "@/cli/optional-validators.js";
import {
	askForApiKey,
	askForValidatorIds,
	confirmLiveModeRun,
	confirmWriteEnvFile,
	isPromptCancel,
	pickStore,
	selectOptionalValidators,
} from "@/cli/prompts.js";
import {
	renderBrandHeader,
	renderCancelMessage,
	renderCliError,
	renderDetected,
	renderReport,
	renderStep,
} from "@/cli/render.js";
import { type StoreChoice, listStoreChoices } from "@/cli/resolve-stores.js";

export interface InitCommandOptions {
	envFile?: string;
	isInteractive?: boolean;
}

export const runInitCommand = async (
	options: InitCommandOptions = {},
): Promise<number> => {
	try {
		return await runInitFlow(options);
	} catch (err) {
		const isCancel = isPromptCancel(err);
		const isUnexpectedError = !isCancel;
		if (isUnexpectedError) throw err;
		const cancelMessage = renderCancelMessage();
		process.stderr.write(cancelMessage);
		return 130;
	}
};

const runInitFlow = async (options: InitCommandOptions): Promise<number> => {
	const isNonInteractive = options.isInteractive === false;
	if (isNonInteractive) {
		const needsTerminalError = renderCliError(
			"`fresh-squeezy init` requires an interactive terminal.",
			[
				"fresh-squeezy doctor --all-stores",
				"fresh-squeezy validate connection",
			],
		);
		process.stderr.write(needsTerminalError);
		return 2;
	}

	const brandHeader = renderBrandHeader(
		"Guided setup",
		"Connect a key, pick the right store, and run a focused billing doctor.",
	);
	process.stdout.write(brandHeader);

	const credentialsStep = renderStep(
		1,
		5,
		"Credentials",
		"reuse env when available",
	);
	process.stdout.write(credentialsStep);
	const apiKey = await resolveApiKey();

	const probeStep = renderStep(
		2,
		5,
		"Account probe",
		"detect mode and reachable stores",
	);
	process.stdout.write(probeStep);
	const { client, connection } = await connectWithDetectedMode(apiKey);
	const mode = client.mode;

	const isConnectionBroken = !connection.ok;
	if (isConnectionBroken) {
		const connectionReport = renderReport({
			ok: false,
			mode,
			results: [connection],
		});
		process.stdout.write(`${connectionReport}\n`);
		return 1;
	}

	const isLiveMode = mode === "live";
	const isLiveRunDeclined = isLiveMode && !(await confirmLiveModeRun());
	if (isLiveRunDeclined) {
		const cancelMessage = renderCancelMessage();
		process.stderr.write(cancelMessage);
		return 130;
	}

	const stores = await listStoreChoices(client);
	const areThereNoStores = stores.length === 0;
	if (areThereNoStores) {
		const noStoresMessage = chalk.yellow(
			"No stores reachable with this key. Create a store in Lemon Squeezy and retry.\n",
		);
		process.stdout.write(noStoresMessage);
		return 1;
	}

	const storeCount = String(stores.length);
	const detectedStores = renderDetected(
		"Stores",
		storeCount,
		"Lemon Squeezy API",
	);
	process.stdout.write(detectedStores);
	const storeStep = renderStep(
		3,
		5,
		"Store selection",
		"auto-select when unambiguous",
	);
	process.stdout.write(storeStep);
	const storeId = await resolveStoreSelection(stores);

	const checksStep = renderStep(
		4,
		5,
		"Optional checks",
		"pick resources before manual IDs",
	);
	process.stdout.write(checksStep);
	const selectedValidators = await selectOptionalValidators();
	const resourceChoices = await discoverChoices(
		client,
		storeId,
		selectedValidators,
	);
	const discoverySummary = renderDiscoverySummary(
		resourceChoices,
		selectedValidators,
	);
	process.stdout.write(discoverySummary);
	const validatorIds = await askForValidatorIds(
		selectedValidators,
		resourceChoices,
	);

	const envFileName = options.envFile ?? ".env";
	const workingDirectory = process.cwd();
	const envPath = path.resolve(workingDirectory, envFileName);
	const checkNames = listValidatorNames(validatorIds);
	const setupSummary = renderSetupSummary({
		envPath,
		mode,
		storeId,
		checkNames,
	});
	process.stdout.write(setupSummary);
	const shouldWrite = await confirmWriteEnvFile(envPath);
	if (shouldWrite) {
		await writeEnvFile(envPath, { apiKey, mode, storeId });
		const wroteMessage = chalk.green(`Wrote ${envPath}\n`);
		process.stdout.write(wroteMessage);
	}

	const checkList = checkNames.join(", ");
	const runningMessage = chalk.dim(`\nRunning doctor (${checkList})...\n\n`);
	process.stdout.write(runningMessage);
	const report = await client.doctor({ storeId, ...validatorIds });
	const doctorReport = renderReport(report);
	process.stdout.write(`${doctorReport}\n`);

	return report.ok ? 0 : 1;
};

const resolveStoreSelection = async (
	stores: StoreChoice[],
): Promise<string> => {
	const [only, ...others] = stores;
	const hasOnlyOneStore = others.length === 0;
	const isThereOnlyOneStore = Boolean(only) && hasOnlyOneStore;
	const isThereAChoiceToMake = !only || !isThereOnlyOneStore;
	if (isThereAChoiceToMake) return pickStore(stores);

	const storeLabel = `${only.name} (${only.slug})`;
	const detectedStore = renderDetected("Store", storeLabel, `id ${only.id}`);
	process.stdout.write(detectedStore);
	return only.id;
};

const resolveApiKey = async (): Promise<string> => {
	const envApiKey = readEnvApiKey();
	const isApiKeyMissing = !envApiKey;
	if (isApiKeyMissing) {
		const answers = await askForApiKey();
		return answers.apiKey;
	}

	const usingEnvMessage = chalk.dim(
		`Using ${ENV_KEYS.apiKey} from environment.\n`,
	);
	process.stdout.write(usingEnvMessage);
	return envApiKey;
};

interface DetectedConnection {
	client: FreshSqueezyClient;
	connection: ValidationResult<ConnectionSummary>;
}

const connectWithDetectedMode = async (
	apiKey: string,
): Promise<DetectedConnection> => {
	const envMode = parseEnvMode();
	const initialMode = envMode ?? "test";
	let client = createFreshSqueezy({ apiKey, mode: initialMode });
	let connection = await client.validateConnection();
	const actualMode = connection.resource?.actualMode;

	const isModeMismatch = Boolean(actualMode) && actualMode !== initialMode;
	if (actualMode && isModeMismatch) {
		const hasEnvMode = Boolean(envMode);
		const message = hasEnvMode
			? `Detected ${actualMode}-mode API key; ignoring ${ENV_KEYS.mode}=${initialMode} for this run.`
			: `Detected ${actualMode}-mode API key.`;
		const mismatchMessage = chalk.yellow(`${message}\n`);
		process.stdout.write(mismatchMessage);
		client = createFreshSqueezy({ apiKey, mode: actualMode });
		connection = await client.validateConnection();
		return { client, connection };
	}

	if (actualMode) {
		const detectedMessage = chalk.dim(`Detected ${actualMode}-mode API key.\n`);
		process.stdout.write(detectedMessage);
		return { client, connection };
	}

	if (envMode) {
		const envModeMessage = chalk.dim(
			`Using ${ENV_KEYS.mode}=${envMode}; API mode was not exposed.\n`,
		);
		process.stdout.write(envModeMessage);
		return { client, connection };
	}

	const fallbackMessage = chalk.dim(
		"Could not auto-detect key mode; using test mode.\n",
	);
	process.stdout.write(fallbackMessage);
	return { client, connection };
};

const parseEnvMode = (): Mode | undefined => {
	const envMode = readEnvMode();
	const isModeMissing = !envMode;
	if (isModeMissing) return undefined;
	const isValidMode = envMode === "test" || envMode === "live";
	if (isValidMode) return envMode;

	const invalidModeMessage = chalk.yellow(
		`Ignoring invalid ${ENV_KEYS.mode}=${envMode}; expected test or live.\n`,
	);
	process.stdout.write(invalidModeMessage);
	return undefined;
};

const listValidatorNames = (validatorIds: OptionalValidatorIds): string[] => {
	const names = ["connection", "store"];
	for (const validatorRow of OPTIONAL_VALIDATORS) {
		const count = validatorIds[validatorRow.field]?.length ?? 0;
		const isThereNoSelection = count === 0;
		if (isThereNoSelection) continue;
		const isSingleSelection = count === 1;
		names.push(
			isSingleSelection
				? validatorRow.resultName
				: `${validatorRow.resultName} x${count}`,
		);
	}
	return names;
};

const renderSetupSummary = (input: {
	envPath: string;
	mode: Mode;
	storeId: string;
	checkNames: string[];
}): string => {
	const readyStep = renderStep(
		5,
		5,
		"Ready to verify",
		"review before writing env",
	);
	const modeLabel = chalk.dim("mode");
	const storeLabel = chalk.dim("store");
	const checksLabel = chalk.dim("checks");
	const envLabel = chalk.dim("env");
	return [
		readyStep,
		`  ${modeLabel}   ${input.mode}`,
		`  ${storeLabel}  ${input.storeId}`,
		`  ${checksLabel} ${input.checkNames.join(", ")}`,
		`  ${envLabel}    ${input.envPath}`,
		"",
	].join("\n");
};

const ENV_LINE_PATTERN = /^([A-Za-z_][A-Za-z0-9_]*)=/;

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
	const hasExistingContent = existing.length > 0;
	const lines = hasExistingContent ? existing.split(/\r?\n/) : [];
	const seen = new Set<string>();
	const next = lines.map((line) => {
		const lineMatch = ENV_LINE_PATTERN.exec(line);
		const key = lineMatch?.[1];
		const isNotAnAssignment = !key;
		if (isNotAnAssignment) return line;
		const isUntouchedKey = !updates.has(key);
		if (isUntouchedKey) return line;
		seen.add(key);
		return `${key}=${updates.get(key) ?? ""}`;
	});

	const lacksTrailingBlankLine = next.length > 0 && next.at(-1) !== "";
	if (lacksTrailingBlankLine) next.push("");

	for (const [key, value] of updates) {
		const isMissingFromFile = !seen.has(key);
		if (isMissingFromFile) next.push(`${key}=${value}`);
	}

	const envDirectory = path.dirname(envPath);
	await fs.mkdir(envDirectory, { recursive: true });
	const joinedLines = next.join("\n");
	const trimmedLines = joinedLines.replace(/\n*$/, "");
	await fs.writeFile(envPath, `${trimmedLines}\n`, { encoding: "utf8" });
};

const isMissingFileError = (err: unknown): boolean => {
	const isObjectError = Boolean(err) && typeof err === "object";
	return (
		isObjectError && err !== null && "code" in err && err.code === "ENOENT"
	);
};

const readEnvFile = async (envPath: string): Promise<string> => {
	try {
		return await fs.readFile(envPath, "utf8");
	} catch (err) {
		const isMissingFile = isMissingFileError(err);
		if (isMissingFile) return "";
		throw err;
	}
};

const renderDiscoverySummary = (
	choices: DiscoveredChoices,
	selectedValidators: OptionalValidatorName[],
): string => {
	const isThereNoSelection = selectedValidators.length === 0;
	if (isThereNoSelection)
		return chalk.dim("  No optional resource checks selected.\n");

	const selectedRows = OPTIONAL_VALIDATORS.filter((validatorRow) =>
		selectedValidators.includes(validatorRow.name),
	);
	const lines = selectedRows.map((validatorRow) => {
		const group = choices[validatorRow.name];
		if (group?.error) {
			return chalk.yellow(
				`  ! ${validatorRow.label} discovery failed; manual entry is available.`,
			);
		}
		const count = String(group?.choices.length ?? 0);
		const detectedLine = renderDetected(
			validatorRow.label,
			count,
			"Lemon Squeezy API",
		);
		return detectedLine.trimEnd();
	});
	return `${lines.join("\n")}\n`;
};
