import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { writeCliFailure } from "./render.js";

export interface AugmentCommandOptions {
	cwd?: string;
	out?: string;
	force?: boolean;
}

type Flavour = "with-sdk" | "generic";

const IMPORT_HINT_NAME: Record<Flavour, string> = {
	"with-sdk": "LemonSqueezyAugmented",
	generic: "WithLatestLemonSqueezyFields",
};

const WITH_LATEST_NAME = "WithLatestLemonSqueezyFields";
const LATEST_NAMES = [
	"LatestSubscriptionFields",
	"LatestSubscriptionInvoiceFields",
	"LatestSubscriptionItemUpdateFields",
	"LatestOrderFields",
	"LatestOrderItemFields",
	"LatestVariantFields",
	"LatestPriceFields",
	"LatestCheckoutFields",
	"LatestCheckoutOptionsFields",
	"LatestCheckoutDataFields",
	"LatestLemonSqueezyResourceName",
	"LatestFieldsFor",
];
const API_TYPE_NAMES = [
	"GeneratedLemonSqueezyFieldMap",
	"GeneratedLemonSqueezyResourceName",
	"GeneratedLemonSqueezyResourceType",
];

const nameLines = (names: string[]): string =>
	names.map((name) => `  ${name},`).join("\n");

const typeImport = (names: string[], source: string): string =>
	`import type {\n${nameLines(names)}\n} from "${source}";`;

const API_TYPES_IMPORT = typeImport(API_TYPE_NAMES, "fresh-squeezy/api-types");

const TYPE_EXPORT = `export type {
${nameLines([WITH_LATEST_NAME, ...LATEST_NAMES, ...API_TYPE_NAMES])}
};`;

export const runAugmentCommand = async (
	options: AugmentCommandOptions = {},
): Promise<number> => {
	const cwd = options.cwd ?? process.cwd();
	const outPath = resolve(cwd, options.out ?? "lemonsqueezy.augment.d.ts");

	try {
		const flavour = await detectFlavour(cwd, options.force ?? false);
		const contents = renderAugmentationFile(flavour);
		const outDirectory = dirname(outPath);
		await mkdir(outDirectory, { recursive: true });
		await writeFile(outPath, contents, "utf8");

		process.stdout.write(`fresh-squeezy: wrote ${outPath} (${flavour}).\n`);
		process.stdout.write(
			`Use it via: import type { ${IMPORT_HINT_NAME[flavour]} } from "./lemonsqueezy.augment";\n`,
		);
		return 0;
	} catch (err) {
		writeCliFailure(err, { hints: [] });
		return 2;
	}
};

const detectFlavour = async (cwd: string, force: boolean): Promise<Flavour> => {
	if (force) return "generic";
	const pkgPath = resolve(cwd, "package.json");
	const isPackageJsonMissing = !existsSync(pkgPath);
	if (isPackageJsonMissing) return "generic";

	const raw = await readFile(pkgPath, "utf8");
	const pkg = JSON.parse(raw) as {
		dependencies?: Record<string, string>;
		devDependencies?: Record<string, string>;
		peerDependencies?: Record<string, string>;
	};

	const deps = {
		...(pkg.dependencies ?? {}),
		...(pkg.devDependencies ?? {}),
		...(pkg.peerDependencies ?? {}),
	};

	const hasOfficialSdk = "@lemonsqueezy/lemonsqueezy.js" in deps;
	return hasOfficialSdk ? "with-sdk" : "generic";
};

const SDK_IMPORT = `import type {
  Subscription,
  SubscriptionInvoice,
  Order,
  OrderItem,
  Variant,
  Price,
  Checkout,
} from "@lemonsqueezy/lemonsqueezy.js";`;

const AUGMENTED_INTERFACE = `/**
 * One-stop reference for resources fresh-squeezy has wider knowledge of
 * than the official SDK. The shape mirrors the SDK's response envelope
 * (\`{ data: { attributes: ... } }\`) — only the inner attributes are
 * widened. Request-only field sets (e.g. subscription-item update params)
 * are not response documents, so they ship as standalone \`Latest*Fields\`
 * exports below rather than as entries here.
 */
export interface LemonSqueezyAugmented {
  subscription: AugmentResponse<Subscription, LatestSubscriptionFields>;
  subscriptionInvoice: AugmentResponse<SubscriptionInvoice, LatestSubscriptionInvoiceFields>;
  order: AugmentResponse<Order, LatestOrderFields>;
  orderItem: AugmentResponse<OrderItem, LatestOrderItemFields>;
  variant: AugmentResponse<Variant, LatestVariantFields>;
  price: AugmentResponse<Price, LatestPriceFields>;
  checkout: AugmentResponse<Checkout, LatestCheckoutFields>;
}`;

const AUGMENT_RESPONSE_HELPER = `/**
 * Helper that walks the official SDK's response envelope and intersects
 * the inner \`attributes\` record with the supplied field set.
 */
type AugmentResponse<T, Fields> = T extends {
  data: infer Data;
}
  ? Data extends { attributes: infer Attrs }
    ? Omit<T, "data"> & {
        data: Omit<Data, "attributes"> & { attributes: Attrs & Fields };
      }
    : T
  : T;

/* Example:
 *
 * import type { LemonSqueezyAugmented } from "./lemonsqueezy.augment";
 *
 * function describe(sub: LemonSqueezyAugmented["subscription"]) {
 *   const attrs = sub.data.attributes;
 *   console.log(attrs.payment_processor); // ← typed, no manual extension
 *   console.log(attrs.urls?.update_customer_portal);
 * }
 */
`;

const GENERIC_EXAMPLE = `/* Example with a hand-rolled or third-party type:
 *
 * import type { WithLatestLemonSqueezyFields } from "./lemonsqueezy.augment";
 *
 * type MySubscription = WithLatestLemonSqueezyFields<MyExistingSubscription, "subscription">;
 *
 * function describe(sub: MySubscription) {
 *   console.log(sub.payment_processor);   // typed
 *   type MyCheckout = WithLatestLemonSqueezyFields<MyExistingCheckout, "checkout">;
 * }
 */
`;

const renderAugmentationFile = (flavour: Flavour): string => {
	const header = `/**
 * Generated by \`fresh-squeezy types augment\` — re-run after upgrading
 * fresh-squeezy to refresh the field set.
 *
 * Why this file exists: the live Lemon Squeezy API has acquired fields
 * since the SDK / hand-rolled types in this repo were last updated
 * (e.g. \`payment_processor\`, \`tax_inclusive\`, \`refunded_amount*\`,
 * \`setup_fee*\`, \`unit_price_decimal\`, checkout color options,
 * \`skip_trial\`, \`variant_quantities\`, subscription item proration
 * flags, and order item \`quantity\`). fresh-squeezy also generates a
 * broad resource map from Lemon Squeezy's object docs, so newly documented
 * attributes can flow in after \`npm run generate:api-types\`.
 *
 * To wire it in:
 *   1. Make sure your tsconfig.json's "include" covers this file (most
 *      do by default if it's in the project root or under "src").
 *   2. Import the augmented type from this file instead of the raw SDK
 *      type — see the example at the bottom of this file.
 */

`;
	const isWithSdk = flavour === "with-sdk";
	if (isWithSdk) {
		const augmentationsImport = typeImport(
			[...LATEST_NAMES, WITH_LATEST_NAME],
			"fresh-squeezy/augmentations",
		);
		return `${header}${SDK_IMPORT}\n${augmentationsImport}\n${API_TYPES_IMPORT}\n\n${AUGMENTED_INTERFACE}\n\n${TYPE_EXPORT}\n\n${AUGMENT_RESPONSE_HELPER}`;
	}

	const augmentationsImport = typeImport(
		[WITH_LATEST_NAME, ...LATEST_NAMES],
		"fresh-squeezy/augmentations",
	);
	return `${header}${augmentationsImport}\n${API_TYPES_IMPORT}\n\n${TYPE_EXPORT}\n\n${GENERIC_EXAMPLE}`;
};
