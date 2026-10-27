import { parseArgs } from "node:util";
import packageJson from "@package.json" with { type: "json" };
import {
	loadEnvironmentFileWhenPresent,
	parseMode,
} from "@/client/environment.js";
import { describeReport } from "@/doctor/describe-report.js";
import {
	createFreshSqueezy,
	type FreshSqueezy,
} from "./create-fresh-squeezy.js";

const EXIT_CODES = { ok: 0, checkFailed: 1, usageError: 2 } as const;

const HELP_MESSAGE = `Usage: fresh-squeezy doctor [flags]

Checks that your Lemon Squeezy store is ready to take payments.

Flags:
  --mode <test|live>      Mode to check. Default: test
  --store-id <id>         Store to check, repeat for more. Default: every store
  --all-resources         Also check every product, plan, webhook, discount and license key in each store
  --product-id <id>       Product to check, repeat for more
  --variant-id <id>       Subscription plan to check, repeat for more
  --webhook-url <url>     Webhook to check, repeat for more
  --discount-id <id>      Discount to check, repeat for more
  --license-key-id <id>   License key to check, repeat for more
  --json                  Print the reports as JSON
  --help                  Show this help
  --version               Show the version

Reads LEMON_SQUEEZY_TEST_API_KEY or LEMON_SQUEEZY_LIVE_API_KEY, by mode, from the environment or ./.env.

Exit codes: 0 every check passed, 1 a check failed, 2 wrong flags or setup.`;

const FLAGS = {
	mode: { type: "string" },
	"store-id": { type: "string", multiple: true },
	"all-resources": { type: "boolean", default: false },
	"product-id": { type: "string", multiple: true },
	"variant-id": { type: "string", multiple: true },
	"webhook-url": { type: "string", multiple: true },
	"discount-id": { type: "string", multiple: true },
	"license-key-id": { type: "string", multiple: true },
	json: { type: "boolean", default: false },
	help: { type: "boolean", default: false },
	version: { type: "boolean", default: false },
} as const;

const readFlags = () => {
	const commandLine = process.argv.slice(2);
	return parseArgs({
		args: commandLine,
		options: FLAGS,
		allowPositionals: true,
	});
};

type Flags = ReturnType<typeof readFlags>["values"];

const pickStoreIdsToCheck = async (
	freshSqueezy: FreshSqueezy,
	flags: Flags,
) => {
	const storeIdFlags = flags["store-id"];
	const areStoresGiven = storeIdFlags !== undefined;
	if (areStoresGiven) return storeIdFlags;
	return freshSqueezy.listStoreIds();
};

const runDoctor = async (flags: Flags) => {
	const modeFlag = flags.mode;
	const isModeGiven = modeFlag !== undefined;
	const mode = isModeGiven ? parseMode(modeFlag) : undefined;
	const freshSqueezy = createFreshSqueezy({ mode });
	const storeIds = await pickStoreIdsToCheck(freshSqueezy, flags);
	const doctorForStore = (storeId: string) =>
		freshSqueezy.doctor({
			storeId,
			allResources: flags["all-resources"],
			productIds: flags["product-id"],
			variantIds: flags["variant-id"],
			webhookUrls: flags["webhook-url"],
			discountIds: flags["discount-id"],
			licenseKeyIds: flags["license-key-id"],
		});
	const reportJobs = storeIds.map(doctorForStore);
	const reports = await Promise.all(reportJobs);
	const isEveryReportOk = reports.every((report) => report.ok);
	const reportsDocument = {
		ok: isEveryReportOk,
		mode: freshSqueezy.mode,
		reports,
	};
	const isJsonAsked = flags.json;
	const printedReports = isJsonAsked
		? JSON.stringify(reportsDocument, null, 2)
		: reports.map(describeReport).join("\n\n");
	process.stdout.write(`${printedReports}\n`);
	return isEveryReportOk ? EXIT_CODES.ok : EXIT_CODES.checkFailed;
};

const main = async () => {
	const { values: flags, positionals } = readFlags();
	const isHelpAsked = flags.help;
	if (isHelpAsked) {
		process.stdout.write(`${HELP_MESSAGE}\n`);
		return EXIT_CODES.ok;
	}
	const isVersionAsked = flags.version;
	if (isVersionAsked) {
		process.stdout.write(`${packageJson.version}\n`);
		return EXIT_CODES.ok;
	}
	const isDoctorCommand =
		positionals.length === 1 && positionals[0] === "doctor";
	const isOtherCommand = !isDoctorCommand;
	if (isOtherCommand) {
		process.stderr.write(`${HELP_MESSAGE}\n`);
		return EXIT_CODES.usageError;
	}
	loadEnvironmentFileWhenPresent();
	return runDoctor(flags);
};

const printUsageError = (error: unknown) => {
	const isErrorInstance = error instanceof Error;
	const message = isErrorInstance ? error.message : String(error);
	process.stderr.write(
		`fresh-squeezy: ${message}\nRun fresh-squeezy --help to see the flags.\n`,
	);
};

try {
	process.exitCode = await main();
} catch (error) {
	printUsageError(error);
	process.exitCode = EXIT_CODES.usageError;
}
