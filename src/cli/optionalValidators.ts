import type { JsonApiResource } from "../core/types.js";
import type { FreshSqueezyClient } from "../createFreshSqueezy.js";
import type {
  DiscountAttributes,
  LicenseKeyAttributes,
  ProductAttributes,
  SubscriptionVariantAttributes,
  WebhookAttributes,
} from "../resources/attributes.js";

/** An optional validator `init` and `doctor --all-resources` can add on top of connection + store. */
export type OptionalValidatorName =
  | "product"
  | "webhook"
  | "discount"
  | "license-key"
  | "subscription-plan";

/** The `doctor()` options the optional validators fill. */
export interface OptionalValidatorIds {
  productIds?: string[];
  webhookUrls?: string[];
  discountIds?: string[];
  licenseKeyIds?: string[];
  variantIds?: string[];
}

interface ResourceChoice {
  label: string;
  value: string;
}

export interface ResourceChoiceGroup {
  choices: ResourceChoice[];
  error?: string;
}

/** Discovered candidates per selected validator; unselected validators are absent. */
export type DiscoveredChoices = Partial<Record<OptionalValidatorName, ResourceChoiceGroup>>;

interface DiscoveryContext {
  client: FreshSqueezyClient;
  storeId: string;
  /** Shared so product and subscription-plan discovery list products once. */
  listProducts: () => Promise<JsonApiResource<ProductAttributes>[]>;
}

/** Everything the CLI needs to offer, discover, prompt for, and report one optional validator. */
export interface OptionalValidator {
  name: OptionalValidatorName;
  field: keyof OptionalValidatorIds;
  /** `ValidationResult.name` of this validator's results. */
  resultName: string;
  label: string;
  menuLabel: string;
  /** Plural noun in "Pick … to validate:" and "No … selected." */
  noun: string;
  manualNoun: string;
  validate?: (value: string) => true | string;
  discover: (context: DiscoveryContext) => Promise<ResourceChoiceGroup>;
}

const errorMessage = (err: unknown): string => (err instanceof Error ? err.message : String(err));

const listChoices = async <TAttributes>(
  load: () => Promise<unknown>,
  toChoice: (item: JsonApiResource<TAttributes>) => ResourceChoice,
): Promise<ResourceChoiceGroup> => {
  try {
    const items = (await load()) as JsonApiResource<TAttributes>[];
    return { choices: items.map(toChoice) };
  } catch (err) {
    return { choices: [], error: errorMessage(err) };
  }
};

/** Keeps the plans found before a variant listing fails, alongside the error. */
const discoverSubscriptionPlans = async ({
  client,
  listProducts,
}: DiscoveryContext): Promise<ResourceChoiceGroup> => {
  const choices: ResourceChoice[] = [];
  try {
    for (const product of await listProducts()) {
      const variants = (await client.variants.list(
        product.id,
      )) as JsonApiResource<SubscriptionVariantAttributes>[];
      for (const variant of variants) {
        if (!variant.attributes.is_subscription) continue;
        const { name, interval, interval_count } = variant.attributes;
        const cadence = interval ? `${interval_count ?? 1}/${interval}` : "no interval";
        choices.push({
          value: variant.id,
          label: `${product.attributes.name} / ${name} (${cadence}) - id ${variant.id}`,
        });
      }
    }
    return { choices };
  } catch (err) {
    return { choices, error: errorMessage(err) };
  }
};

const isHttpUrl = (value: string): boolean => {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

const validateWebhookUrls = (value: string): true | string => {
  const urls = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return urls.every(isHttpUrl) ? true : "Enter valid webhook URLs.";
};

/** The optional validators, in the order they are offered, discovered, and reported. */
export const OPTIONAL_VALIDATORS: OptionalValidator[] = [
  {
    name: "product",
    field: "productIds",
    resultName: "product",
    label: "Products",
    menuLabel: "Product checkout",
    noun: "products",
    manualNoun: "Product IDs",
    discover: ({ listProducts }) =>
      listChoices<ProductAttributes>(listProducts, (product) => ({
        value: product.id,
        label: `${product.attributes.name} (${product.attributes.status}) - id ${product.id}`,
      })),
  },
  {
    name: "webhook",
    field: "webhookUrls",
    resultName: "webhook",
    label: "Webhooks",
    menuLabel: "Webhook registration",
    noun: "webhook URLs",
    manualNoun: "Webhook URLs",
    validate: validateWebhookUrls,
    discover: ({ client, storeId }) =>
      listChoices<WebhookAttributes>(
        () => client.webhooks.list(storeId),
        (webhook) => ({
          value: webhook.attributes.url,
          label: `${webhook.attributes.url} - id ${webhook.id}`,
        }),
      ),
  },
  {
    name: "discount",
    field: "discountIds",
    resultName: "discount",
    label: "Discounts",
    menuLabel: "Discount code",
    noun: "discounts",
    manualNoun: "Discount IDs",
    discover: ({ client, storeId }) =>
      listChoices<DiscountAttributes>(
        () => client.discounts.list(storeId),
        (discount) => ({
          value: discount.id,
          label: `${discount.attributes.name} (${discount.attributes.code}) - id ${discount.id}`,
        }),
      ),
  },
  {
    name: "license-key",
    field: "licenseKeyIds",
    resultName: "licenseKey",
    label: "License keys",
    menuLabel: "License key",
    noun: "license keys",
    manualNoun: "License key IDs",
    discover: ({ client, storeId }) =>
      listChoices<LicenseKeyAttributes>(
        () => client.licenseKeys.list(storeId),
        (key) => ({
          value: key.id,
          label: `${key.attributes.key_short} (${key.attributes.status}) - id ${key.id}`,
        }),
      ),
  },
  {
    name: "subscription-plan",
    field: "variantIds",
    resultName: "subscriptionPlan",
    label: "Subscription plans",
    menuLabel: "Subscription plan",
    noun: "subscription plans",
    manualNoun: "Subscription plan variant IDs",
    discover: discoverSubscriptionPlans,
  },
];

/**
 * List candidates for each selected validator in one store. A failed listing
 * becomes that group's `error` instead of failing the run.
 */
export const discoverChoices = async (
  client: FreshSqueezyClient,
  storeId: string,
  names: OptionalValidatorName[],
): Promise<DiscoveredChoices> => {
  let products: Promise<JsonApiResource<ProductAttributes>[]> | undefined;
  const context: DiscoveryContext = {
    client,
    storeId,
    listProducts: () => {
      products ??= client.products.list(storeId) as Promise<JsonApiResource<ProductAttributes>[]>;
      return products;
    },
  };

  const choices: DiscoveredChoices = {};
  for (const row of OPTIONAL_VALIDATORS) {
    if (names.includes(row.name)) choices[row.name] = await row.discover(context);
  }
  return choices;
};
