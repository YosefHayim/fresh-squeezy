import { ENV_KEYS } from "../core/config.js";
import { FreshSqueezyError } from "../core/errors.js";
import type { ValidateTarget } from "./commands/validate.js";

export function renderCliError(message: string, hints: string[] = []): string {
  const lines = [`fresh-squeezy: ${message}`];

  if (hints.length > 0) {
    lines.push("", "Try:");
    for (const hint of hints) {
      lines.push(`  ${hint}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

export function getDoctorHints(err: unknown): string[] {
  if (!isFreshSqueezyError(err)) return [];

  if (err.code === "MISSING_API_KEY") {
    return [
      "fresh-squeezy init",
      `export ${ENV_KEYS.apiKey}=ls_live_or_test_key`,
    ];
  }

  if (err.code === "INVALID_MODE") {
    return ["fresh-squeezy doctor --mode test", "fresh-squeezy doctor --mode live"];
  }

  if (err.code === "NO_STORES") {
    return ["Check that the API key belongs to an account with a Lemon Squeezy store."];
  }

  return [];
}

export function getValidateHints(err: unknown, target: ValidateTarget): string[] {
  if (!isFreshSqueezyError(err)) return [];

  if (err.code === "MISSING_API_KEY") {
    return [
      "fresh-squeezy init",
      `export ${ENV_KEYS.apiKey}=ls_live_or_test_key`,
    ];
  }

  if (err.code === "INVALID_MODE") {
    return [
      `fresh-squeezy validate ${target} --mode test`,
      `fresh-squeezy validate ${target} --mode live`,
    ];
  }

  if (err.code === "MISSING_ARG") {
    return getMissingArgHints(target);
  }

  return [];
}

function getMissingArgHints(target: ValidateTarget): string[] {
  if (target === "connection") {
    return ["fresh-squeezy validate connection"];
  }

  if (target === "store") {
    return [
      "fresh-squeezy validate store --store-ids 12",
      "fresh-squeezy validate store --all-stores",
    ];
  }

  if (target === "product") {
    return ["fresh-squeezy validate product --product-id 987"];
  }

  if (target === "webhook") {
    return [
      "fresh-squeezy validate webhook --store-ids 12 --webhook-url https://app.example.com/api/webhooks/lemon-squeezy",
      "fresh-squeezy validate webhook --all-stores --webhook-url https://app.example.com/api/webhooks/lemon-squeezy",
    ];
  }

  if (target === "discount") {
    return ["fresh-squeezy validate discount --store-ids 12 --discount-id 123"];
  }

  if (target === "license-key") {
    return ["fresh-squeezy validate license-key --store-ids 12 --license-key-id 123"];
  }

  return ["fresh-squeezy validate subscription-plan --store-ids 12 --variant-id 123"];
}

function isFreshSqueezyError(err: unknown): err is FreshSqueezyError {
  return err instanceof FreshSqueezyError;
}
