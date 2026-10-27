import type { JsonApiDocument } from "@/shared/contracts.js";
import type {
	GeneratedAffiliateAttributes,
	GeneratedCheckoutAttributes,
	GeneratedCustomerAttributes,
	GeneratedDiscountAttributes,
	GeneratedDiscountRedemptionAttributes,
	GeneratedFileAttributes,
	GeneratedLicenseKeyAttributes,
	GeneratedLicenseKeyInstanceAttributes,
	GeneratedOrderAttributes,
	GeneratedOrderItemAttributes,
	GeneratedPriceAttributes,
	GeneratedProductAttributes,
	GeneratedStoreAttributes,
	GeneratedSubscriptionAttributes,
	GeneratedSubscriptionInvoiceAttributes,
	GeneratedSubscriptionItemAttributes,
	GeneratedUsageRecordAttributes,
	GeneratedUserAttributes,
	GeneratedVariantAttributes,
	GeneratedWebhookAttributes,
} from "@/shared/lemon-squeezy-api-types.js";

export interface UserAttributes extends GeneratedUserAttributes {
	name: string;
	email: string;
	color?: string;
	avatar_url?: string | null;
	has_custom_avatar?: boolean;
	createdAt?: string;
	updatedAt?: string;
}

export interface UserMeta {
	test_mode?: boolean;
}

export type AuthenticatedUserDocument = JsonApiDocument<UserAttributes> & {
	meta?: UserMeta;
};

export interface StoreAttributes extends GeneratedStoreAttributes {
	name: string;
	slug: string;
	domain?: string | null;
	url?: string | null;
	country?: string;
	currency?: string;
	plan?: string;
	created_at?: string;
	updated_at?: string;
}

export interface ProductAttributes extends GeneratedProductAttributes {
	name: string;
	slug: string;
	description?: string | null;
	status: "draft" | "published";
	status_formatted?: string;
	store_id: number;
	buy_now_url?: string | null;
	from_price?: number | null;
	to_price?: number | null;
	created_at?: string;
	updated_at?: string;
}

export interface VariantLink {
	title: string;
	url: string;
}

export interface VariantAttributes extends GeneratedVariantAttributes {
	product_id: number;
	name: string;
	slug: string;
	description?: string | null;
	has_license_keys?: boolean;
	license_activation_limit?: number | null;
	is_license_limit_unlimited?: boolean;
	license_length_value?: number | null;
	license_length_unit?: "day" | "week" | "month" | "year" | null;
	is_license_length_unlimited?: boolean;
	status: "pending" | "draft" | "published";
	status_formatted?: string;
	is_subscription?: boolean;
	interval?: string | null;
	interval_count?: number | null;
	sort?: number;
	links?: VariantLink[] | Record<string, string>;
	created_at?: string;
	updated_at?: string;
	test_mode?: boolean;
}

export interface SubscriptionVariantAttributes extends VariantAttributes {
	is_subscription: boolean;
	interval: string | null;
	interval_count: number | null;
	has_free_trial: boolean;
	trial_interval: string | null;
	trial_interval_count: number | null;
	price: number;
}

export interface PriceAttributes extends GeneratedPriceAttributes {
	variant_id: number;
	category: "one_time" | "subscription" | "lead_magnet" | "pwyw";
	scheme: "standard" | "package" | "graduated" | "volume";
	usage_aggregation?: string | null;
	unit_price?: number;
	unit_price_decimal?: string | null;
	package_size?: number;
	tiers?: unknown;
	renewal_interval_unit?: "day" | "week" | "month" | "year" | null;
	renewal_interval_quantity?: number | null;
	trial_interval_unit?: "day" | "week" | "month" | "year" | null;
	trial_interval_quantity?: number | null;
	min_price?: number | null;
	suggested_price?: number | null;
	tax_code?: string;
	setup_fee_enabled?: boolean | null;
	setup_fee?: number | null;
	created_at?: string;
	updated_at?: string;
}

export interface FileAttributes extends GeneratedFileAttributes {}

export type CustomerStatus =
	| "subscribed"
	| "unsubscribed"
	| "archived"
	| "requires_verification"
	| "invalid_email"
	| "bounced";

export interface CustomerUrls {
	customer_portal?: string | null;
}

export interface CustomerAttributes extends GeneratedCustomerAttributes {
	store_id: number;
	name: string;
	email: string;
	status: CustomerStatus;
	city?: string | null;
	region?: string | null;
	country?: string | null;
	total_revenue_currency: number;
	mrr: number;
	status_formatted: string;
	country_formatted?: string | null;
	total_revenue_currency_formatted: string;
	mrr_formatted: string;
	urls?: CustomerUrls;
	created_at?: string;
	updated_at?: string;
	test_mode?: boolean;
}

export interface OrderUrls {
	receipt?: string;
}

export interface OrderFirstItem {
	id: number;
	order_id?: number;
	product_id: number;
	variant_id: number;
	product_name: string;
	variant_name: string;
	price: number;
	quantity?: number;
	created_at?: string;
	updated_at?: string;
}

export interface OrderAttributes extends GeneratedOrderAttributes {
	store_id: number;
	customer_id?: number;
	identifier: string;
	order_number: number;
	user_name: string;
	user_email: string;
	currency: string;
	currency_rate: string;
	subtotal: number;
	setup_fee?: number;
	discount_total: number;
	tax: number;
	tax_inclusive?: boolean;
	total: number;
	refunded_amount?: number;
	subtotal_usd?: number;
	setup_fee_usd?: number;
	discount_total_usd?: number;
	tax_usd?: number;
	total_usd?: number;
	refunded_amount_usd?: number | null;
	tax_name?: string | null;
	tax_rate?: number | string | null;
	refunded_amount_formatted?: string | null;
	refunded?: boolean;
	refunded_at?: string | null;
	status:
		| "pending"
		| "failed"
		| "paid"
		| "refunded"
		| "fraudulent"
		| "partial_refund";
	status_formatted: string;
	subtotal_formatted?: string;
	setup_fee_formatted?: string;
	discount_total_formatted?: string;
	tax_formatted?: string;
	total_formatted?: string;
	first_order_item?: OrderFirstItem | null;
	urls?: OrderUrls;
	created_at?: string;
	updated_at?: string;
	test_mode?: boolean;
}

export interface OrderItemAttributes extends GeneratedOrderItemAttributes {
	order_id: number;
	product_id: number;
	variant_id: number;
	product_name: string;
	variant_name: string;
	price: number;
	quantity: number;
	created_at?: string;
	updated_at?: string;
}

export interface SubscriptionUrls {
	update_payment_method?: string;
	customer_portal?: string;
	update_customer_portal?: string | null;
	customer_portal_update_subscription?: string | null;
}

export interface SubscriptionPause {
	mode: "void" | "free" | string;
	resumes_at?: string | null;
}

export interface SubscriptionItemSummary {
	id: number;
	subscription_id: number;
	price_id: number;
	quantity: number;
	created_at?: string;
	updated_at?: string;
}

export interface SubscriptionAttributes
	extends GeneratedSubscriptionAttributes {
	store_id: number;
	customer_id: number;
	order_id?: number;
	order_item_id?: number;
	product_id: number;
	variant_id: number;
	product_name: string;
	variant_name: string;
	user_name: string;
	user_email: string;
	status:
		| "on_trial"
		| "active"
		| "paused"
		| "past_due"
		| "unpaid"
		| "cancelled"
		| "expired";
	status_formatted: string;
	card_brand?: string | null;
	card_last_four?: string | null;
	payment_processor?: "stripe" | "lemonsqueezy" | "paypal" | string;
	pause?: SubscriptionPause | null;
	cancelled?: boolean;
	trial_ends_at?: string | null;
	billing_anchor?: number;
	first_subscription_item?: SubscriptionItemSummary | null;
	urls?: SubscriptionUrls;
	renews_at?: string | null;
	ends_at?: string | null;
	created_at?: string;
	updated_at?: string;
	test_mode?: boolean;
	tax_inclusive?: boolean;
}

export interface SubscriptionItemAttributes
	extends GeneratedSubscriptionItemAttributes {
	subscription_id: number;
	price_id: number;
	quantity: number;
	is_usage_based: boolean;
	created_at?: string;
	updated_at?: string;
}

export interface SubscriptionItemUpdateAttributes {
	quantity?: number;
	invoice_immediately?: boolean;
	disable_prorations?: boolean;
}

export const buildSubscriptionItemUpdateBody = (
	subscriptionItemId: string | number,
	attributes: SubscriptionItemUpdateAttributes,
): unknown => {
	return {
		data: {
			type: "subscription-items",
			id: String(subscriptionItemId),
			attributes,
		},
	};
};

export type SubscriptionInvoiceStatus =
	| "pending"
	| "paid"
	| "void"
	| "refunded"
	| "partial_refund";

export type SubscriptionInvoiceBillingReason =
	| "initial"
	| "renewal"
	| "updated";

export interface SubscriptionInvoiceUrls {
	invoice_url?: string;
}

export interface SubscriptionInvoiceAttributes
	extends GeneratedSubscriptionInvoiceAttributes {
	store_id: number;
	subscription_id: number;
	customer_id: number;
	user_name: string;
	user_email: string;
	billing_reason: SubscriptionInvoiceBillingReason | string;
	card_brand?: string | null;
	card_last_four?: string | null;
	currency: string;
	currency_rate: string;
	status: SubscriptionInvoiceStatus;
	status_formatted: string;
	refunded: boolean;
	refunded_at: string | null;
	subtotal: number;
	discount_total: number;
	tax: number;
	tax_inclusive: boolean;
	total: number;
	refunded_amount: number;
	subtotal_usd: number;
	discount_total_usd: number;
	tax_usd: number;
	total_usd: number;
	refunded_amount_usd: number;
	subtotal_formatted: string;
	discount_total_formatted: string;
	tax_formatted: string;
	total_formatted: string;
	refunded_amount_formatted: string;
	urls?: SubscriptionInvoiceUrls;
	created_at?: string;
	updated_at?: string;
	test_mode?: boolean;
}

export type UsageRecordAction = "increment" | "set";

export interface UsageRecordAttributes extends GeneratedUsageRecordAttributes {
	subscription_item_id: number;
	quantity: number;
	action: UsageRecordAction;
	created_at?: string;
	updated_at?: string;
}

export interface DiscountAttributes extends GeneratedDiscountAttributes {
	name: string;
	code: string;
	amount: number;
	amount_type: "percent" | "fixed";
	is_limited_to_products: boolean;
	is_limited_redemptions: boolean;
	max_redemptions: number;
	starts_at: string | null;
	expires_at: string | null;
	status: "draft" | "published";
	duration: "once" | "repeating" | "forever";
	store_id: number;
	created_at?: string;
	updated_at?: string;
}

export interface DiscountRedemptionAttributes
	extends GeneratedDiscountRedemptionAttributes {
	discount_id: number;
	order_id: number;
	discount_name: string;
	discount_code: string;
	discount_amount: number;
	discount_amount_type: "percent" | "fixed";
	amount: number;
	created_at?: string;
	updated_at?: string;
}

export interface LicenseKeyAttributes extends GeneratedLicenseKeyAttributes {
	key_short: string;
	status: "active" | "inactive" | "expired" | "disabled";
	expires_at: string | null;
	activation_limit: number | null;
	instances_count: number;
	disabled: boolean;
	store_id: number;
	created_at?: string;
	updated_at?: string;
}

export interface LicenseKeyInstanceAttributes
	extends GeneratedLicenseKeyInstanceAttributes {
	license_key_id: number;
	identifier: string;
	name: string;
	created_at?: string;
	updated_at?: string;
}

export type CheckoutLocale =
	| "bg"
	| "hr"
	| "cs"
	| "da"
	| "nl"
	| "en"
	| "et"
	| "fil"
	| "fi"
	| "fr"
	| "de"
	| "el"
	| "hu"
	| "id"
	| "it"
	| "ja"
	| "ko"
	| "lv"
	| "lt"
	| "ms"
	| "mt"
	| "pl"
	| "pt"
	| "ro"
	| "ru"
	| "zh-CN"
	| "sk"
	| "sl"
	| "es"
	| "sv"
	| "th"
	| "tr"
	| "vi";

export interface CheckoutProductOptions {
	name?: string;
	description?: string;
	media?: string[];
	redirect_url?: string;
	receipt_button_text?: string;
	receipt_link_url?: string;
	receipt_thank_you_note?: string;
	enabled_variants?: number[];
}

export interface CheckoutOptions {
	embed?: boolean;
	media?: boolean;
	logo?: boolean;
	desc?: boolean;
	discount?: boolean;
	subscription_preview?: boolean;
	skip_trial?: boolean;
	dark?: boolean;
	background_color?: string;
	headings_color?: string;
	primary_text_color?: string;
	secondary_text_color?: string;
	links_color?: string;
	borders_color?: string;
	checkbox_color?: string;
	active_state_color?: string;
	button_color?: string;
	button_text_color?: string;
	terms_privacy_color?: string;
	locale?: CheckoutLocale | string | null;
}

export interface CheckoutVariantQuantity {
	variant_id: number;
	quantity: number;
}

export interface CheckoutData {
	email?: string;
	name?: string;
	billing_address?: {
		country?: string;
		zip?: string;
	};
	tax_number?: string;
	discount_code?: string;
	custom?: Record<string, unknown>;
	variant_quantities?: CheckoutVariantQuantity[];
}

export interface CheckoutPreview {
	currency: string;
	currency_rate: number | string;
	subtotal: number;
	discount_total: number;
	tax: number;
	total: number;
	subtotal_usd: number;
	discount_total_usd: number;
	tax_usd: number;
	total_usd: number;
	subtotal_formatted: string;
	discount_total_formatted: string;
	tax_formatted: string;
	total_formatted: string;
}

export interface CheckoutAttributes extends GeneratedCheckoutAttributes {
	store_id: number;
	variant_id: number;
	custom_price?: number | null;
	product_options?: CheckoutProductOptions;
	checkout_options?: CheckoutOptions;
	checkout_data?: CheckoutData;
	preview?: CheckoutPreview;
	expires_at?: string | null;
	url?: string;
	created_at?: string;
	updated_at?: string;
	test_mode?: boolean;
}

export interface WebhookAttributes extends GeneratedWebhookAttributes {
	store_id: number;
	url: string;
	events: string[];
	last_sent_at?: string | null;
	created_at?: string;
	updated_at?: string;
	test_mode?: boolean;
}

export type AffiliateStatus = "active" | "pending" | "disabled";

export interface AffiliateAttributes extends GeneratedAffiliateAttributes {
	store_id: number;
	user_id: number;
	user_name: string;
	user_email: string;
	share_domain: string;
	status: AffiliateStatus;
	application_note?: string | null;
	products?: unknown;
	total_earnings: number;
	unpaid_earnings: number;
	created_at?: string;
	updated_at?: string;
}
