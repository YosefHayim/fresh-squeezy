import type { FreshSqueezyClient } from "../createFreshSqueezy.js";
import type { RequestOptions } from "../core/http.js";
import type { JsonApiCollection, JsonApiResource } from "../core/types.js";
import type { DiscountAttributes } from "../resources/discounts.js";
import type { LicenseKeyAttributes } from "../resources/licenseKeys.js";
import type { ProductAttributes } from "../resources/products.js";
import type { SubscriptionVariantAttributes } from "../resources/variants.js";
import type { WebhookAttributes } from "../resources/webhooks.js";
import type { InitDoctorTarget } from "./prompts.js";

export interface ResourceChoice {
  label: string;
  value: string;
}

export interface ResourceChoiceGroup {
  choices: ResourceChoice[];
  error?: string;
}

export interface InitResourceChoices {
  products: ResourceChoiceGroup;
  webhooks: ResourceChoiceGroup;
  discounts: ResourceChoiceGroup;
  licenseKeys: ResourceChoiceGroup;
  subscriptionPlans: ResourceChoiceGroup;
}

export const EMPTY_INIT_RESOURCE_CHOICES: InitResourceChoices = {
  products: { choices: [] },
  webhooks: { choices: [] },
  discounts: { choices: [] },
  licenseKeys: { choices: [] },
  subscriptionPlans: { choices: [] },
};

export async function discoverInitResourceChoices(
  client: FreshSqueezyClient,
  storeId: string,
  targets: InitDoctorTarget[]
): Promise<InitResourceChoices> {
  const choices: InitResourceChoices = {
    products: { choices: [] },
    webhooks: { choices: [] },
    discounts: { choices: [] },
    licenseKeys: { choices: [] },
    subscriptionPlans: { choices: [] },
  };
  let products: JsonApiResource<ProductAttributes>[] | undefined;

  if (targets.includes("product") || targets.includes("subscription-plan")) {
    const result = await discover(() =>
      paginate<ProductAttributes>(client, "/v1/products", { "filter[store_id]": storeId })
    );
    if (result.ok) {
      products = result.value;
      choices.products = { choices: result.value.map(toProductChoice) };
    } else {
      choices.products = { choices: [], error: result.error };
    }
  }

  if (targets.includes("webhook")) {
    const result = await discover(() =>
      paginate<WebhookAttributes>(client, "/v1/webhooks", { "filter[store_id]": storeId })
    );
    choices.webhooks = result.ok
      ? { choices: result.value.map(toWebhookChoice) }
      : { choices: [], error: result.error };
  }

  if (targets.includes("discount")) {
    const result = await discover(() =>
      paginate<DiscountAttributes>(client, "/v1/discounts", { "filter[store_id]": storeId })
    );
    choices.discounts = result.ok
      ? { choices: result.value.map(toDiscountChoice) }
      : { choices: [], error: result.error };
  }

  if (targets.includes("license-key")) {
    const result = await discover(() =>
      paginate<LicenseKeyAttributes>(client, "/v1/license-keys", { "filter[store_id]": storeId })
    );
    choices.licenseKeys = result.ok
      ? { choices: result.value.map(toLicenseKeyChoice) }
      : { choices: [], error: result.error };
  }

  if (targets.includes("subscription-plan")) {
    const listedProducts = products ?? [];
    if (choices.products.error) {
      choices.subscriptionPlans = { choices: [], error: choices.products.error };
    } else {
      choices.subscriptionPlans = await discoverSubscriptionPlans(client, listedProducts);
    }
  }

  return choices;
}

async function discoverSubscriptionPlans(
  client: FreshSqueezyClient,
  products: JsonApiResource<ProductAttributes>[]
): Promise<ResourceChoiceGroup> {
  const discovered: ResourceChoice[] = [];

  for (const product of products) {
    const result = await discover(() =>
      paginate<SubscriptionVariantAttributes>(client, "/v1/variants", {
        "filter[product_id]": product.id,
      })
    );
    if (!result.ok) {
      return { choices: discovered, error: result.error };
    }

    for (const variant of result.value) {
      if (variant.attributes.is_subscription) {
        discovered.push(toSubscriptionPlanChoice(variant, product.attributes.name));
      }
    }
  }

  return { choices: discovered };
}

async function paginate<TAttributes>(
  client: FreshSqueezyClient,
  path: string,
  query: RequestOptions["query"]
): Promise<JsonApiResource<TAttributes>[]> {
  const all: JsonApiResource<TAttributes>[] = [];
  let pageNumber = Number(query?.["page[number]"] ?? 1);

  while (true) {
    const doc = await client.request<JsonApiCollection<TAttributes>>({
      path,
      query: { ...(query ?? {}), "page[number]": pageNumber },
    });
    all.push(...doc.data);

    const lastPage = doc.meta?.page?.lastPage;
    if (lastPage === undefined || pageNumber >= lastPage) return all;
    pageNumber += 1;
  }
}

async function discover<T>(
  load: () => Promise<T>
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await load() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function toProductChoice(product: JsonApiResource<ProductAttributes>): ResourceChoice {
  return {
    value: product.id,
    label: `${product.attributes.name} (${product.attributes.status}) - id ${product.id}`,
  };
}

function toWebhookChoice(webhook: JsonApiResource<WebhookAttributes>): ResourceChoice {
  return {
    value: webhook.attributes.url,
    label: `${webhook.attributes.url} - id ${webhook.id}`,
  };
}

function toDiscountChoice(discount: JsonApiResource<DiscountAttributes>): ResourceChoice {
  return {
    value: discount.id,
    label: `${discount.attributes.name} (${discount.attributes.code}) - id ${discount.id}`,
  };
}

function toLicenseKeyChoice(licenseKey: JsonApiResource<LicenseKeyAttributes>): ResourceChoice {
  return {
    value: licenseKey.id,
    label: `${licenseKey.attributes.key_short} (${licenseKey.attributes.status}) - id ${licenseKey.id}`,
  };
}

function toSubscriptionPlanChoice(
  variant: JsonApiResource<SubscriptionVariantAttributes>,
  productName: string
): ResourceChoice {
  const interval = variant.attributes.interval
    ? `${variant.attributes.interval_count ?? 1}/${variant.attributes.interval}`
    : "no interval";
  return {
    value: variant.id,
    label: `${productName} / ${variant.attributes.name} (${interval}) - id ${variant.id}`,
  };
}
