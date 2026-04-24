import fs from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import { createFreshSqueezy } from "../../createFreshSqueezy.js";
import { ENV_KEYS } from "../../core/config.js";
import { renderReport } from "../render.js";
import { askForCredentials, confirmWriteEnvFile, pickStore } from "../prompts.js";

export interface InitCommandOptions {
  envFile?: string;
}

/**
 * `fresh-squeezy init` — interactive onboarding. Walks the user through the
 * fastest path from "I have an API key" to "my integration is verified":
 *
 *  1. Ask for API key + mode.
 *  2. List reachable stores via `/v1/stores`, let the user pick one.
 *  3. Optionally persist credentials to `.env.local`.
 *  4. Run `doctor()` against the chosen config and print the report.
 *
 * Returns an exit code so the CLI wrapper can forward it to `process.exit`.
 */
export async function runInitCommand(options: InitCommandOptions = {}): Promise<number> {
  const answers = await askForCredentials();
  const client = createFreshSqueezy({ apiKey: answers.apiKey, mode: answers.mode });

  const connection = await client.validateConnection();
  if (!connection.ok) {
    process.stdout.write(`${renderReport({ ok: false, mode: answers.mode, results: [connection] })}\n`);
    return 1;
  }

  const storeIds = connection.resource?.storeIds ?? [];
  if (storeIds.length === 0) {
    process.stdout.write(
      chalk.yellow("No stores reachable with this key. Create a store in Lemon Squeezy and retry.\n")
    );
    return 1;
  }

  const stores = await Promise.all(storeIds.map((id) => client.validateStore(id)));
  const pickable = stores
    .filter((entry) => entry.ok && entry.resource)
    .map((entry, index) => ({
      id: storeIds[index] ?? "",
      name: entry.resource?.name ?? "(unnamed)",
      slug: entry.resource?.slug ?? "",
    }))
    .filter((entry) => entry.id !== "");

  const storeId = await pickStore(pickable);

  const envPath = path.resolve(process.cwd(), options.envFile ?? ".env.local");
  const shouldWrite = await confirmWriteEnvFile(envPath);
  if (shouldWrite) {
    await writeEnvFile(envPath, { apiKey: answers.apiKey, mode: answers.mode, storeId });
    process.stdout.write(chalk.green(`Wrote ${envPath}\n`));
  }

  process.stdout.write(chalk.dim("\nRunning doctor...\n\n"));
  const report = await client.doctor({ storeId });
  process.stdout.write(`${renderReport(report)}\n`);

  return report.ok ? 0 : 1;
}

async function writeEnvFile(
  envPath: string,
  values: { apiKey: string; mode: string; storeId: string }
): Promise<void> {
  const lines = [
    `${ENV_KEYS.apiKey}=${values.apiKey}`,
    `${ENV_KEYS.storeId}=${values.storeId}`,
    `${ENV_KEYS.mode}=${values.mode}`,
    "",
  ];
  await fs.writeFile(envPath, lines.join("\n"), { encoding: "utf8" });
}
