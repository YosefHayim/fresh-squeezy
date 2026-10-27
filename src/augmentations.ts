import type {
	CheckoutOptions,
	OrderItemAttributes,
	PriceAttributes,
	SubscriptionItemUpdateAttributes,
} from "./shared/attributes.js";
import type {
	GeneratedLemonSqueezyFieldMap,
	GeneratedLemonSqueezyResourceName,
} from "./shared/lemon-squeezy-api-types.js";

export interface LatestSubscriptionFields {
	payment_processor?: "stripe" | "lemonsqueezy" | "paypal" | string;
	urls?: {
		update_payment_method?: string;
		customer_portal?: string;
		update_customer_portal?: string;
		[other: string]: string | undefined;
	};
}

export interface LatestSubscriptionInvoiceFields {
	customer_id?: number;
	user_name?: string;
	user_email?: string;
	tax_inclusive?: boolean;
	refunded_amount?: number;
	refunded_amount_usd?: number | null;
	refunded_amount_formatted?: string | null;
}

export interface LatestOrderFields {
	status?:
		| "pending"
		| "failed"
		| "paid"
		| "refunded"
		| "fraudulent"
		| "partial_refund";
	tax_inclusive?: boolean;
	refunded_amount?: number;
	refunded_amount_usd?: number | null;
	refunded_amount_formatted?: string | null;
	setup_fee?: number;
	setup_fee_usd?: number;
	setup_fee_formatted?: string;
	urls?: {
		receipt?: string;
		[other: string]: string | undefined;
	};
}

export type LatestOrderItemFields = Partial<
	Pick<OrderItemAttributes, "quantity">
>;

export interface LatestVariantFields {
	links?: Array<{ title: string; url: string }> | Record<string, string>;
}

export type LatestPriceFields = Pick<
	PriceAttributes,
	"setup_fee_enabled" | "setup_fee" | "unit_price_decimal"
>;

export type LatestCheckoutOptionsFields = Pick<
	CheckoutOptions,
	| "skip_trial"
	| "dark"
	| "background_color"
	| "headings_color"
	| "primary_text_color"
	| "secondary_text_color"
	| "links_color"
	| "borders_color"
	| "checkbox_color"
	| "active_state_color"
	| "button_color"
	| "button_text_color"
	| "terms_privacy_color"
>;

export interface LatestCheckoutDataFields {
	variant_quantities?: Array<{ variant_id: number; quantity: number }>;
}

export interface LatestCheckoutFields {
	checkout_options?: LatestCheckoutOptionsFields & Record<string, unknown>;
	checkout_data?: LatestCheckoutDataFields & Record<string, unknown>;
}

export type LatestSubscriptionItemUpdateFields = Pick<
	SubscriptionItemUpdateAttributes,
	"invoice_immediately" | "disable_prorations"
>;

export interface LatestLemonSqueezyFieldMap {
	subscription: LatestSubscriptionFields;
	subscriptionInvoice: LatestSubscriptionInvoiceFields;
	subscriptionItemUpdate: LatestSubscriptionItemUpdateFields;
	order: LatestOrderFields;
	orderItem: LatestOrderItemFields;
	variant: LatestVariantFields;
	price: LatestPriceFields;
	checkout: LatestCheckoutFields;
}

export type LatestLemonSqueezyResourceName =
	| keyof LatestLemonSqueezyFieldMap
	| GeneratedLemonSqueezyResourceName;

export type LatestFieldsFor<R extends LatestLemonSqueezyResourceName> =
	R extends keyof LatestLemonSqueezyFieldMap
		? LatestLemonSqueezyFieldMap[R]
		: R extends GeneratedLemonSqueezyResourceName
			? GeneratedLemonSqueezyFieldMap[R]
			: never;

export type WithLatestLemonSqueezyFields<
	T,
	R extends LatestLemonSqueezyResourceName,
> = T & LatestFieldsFor<R>;
