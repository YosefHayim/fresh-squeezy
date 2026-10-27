export type IntervalUnit = "day" | "week" | "month" | "year";

export interface UserAttributes {
	name: string;
	email: string;
	color?: string | null;
	avatar_url?: string | null;
	has_custom_avatar?: boolean | null;
	createdAt?: string | null;
	updatedAt?: string | null;
}

export interface UserMeta {
	test_mode?: boolean;
}

export interface StoreAttributes {
	name: string;
	slug: string;
	domain?: string | null;
	url?: string | null;
	avatar_url?: string | null;
	country?: string | null;
	currency?: string | null;
	plan?: string | null;
	total_sales?: number | null;
	total_revenue?: number | null;
	thirty_day_sales?: number | null;
	thirty_day_revenue?: number | null;
	created_at?: string | null;
	updated_at?: string | null;
}

export interface CustomerUrls {
	customer_portal?: string | null;
}

export interface CustomerAttributes {
	store_id: number;
	name: string;
	email: string;
	status:
		| "subscribed"
		| "unsubscribed"
		| "archived"
		| "requires_verification"
		| "invalid_email"
		| "bounced";
	status_formatted: string;
	city?: string | null;
	region?: string | null;
	country?: string | null;
	country_formatted?: string | null;
	total_revenue_currency: number;
	total_revenue_currency_formatted: string;
	mrr: number;
	mrr_formatted: string;
	urls?: CustomerUrls | null;
	created_at?: string | null;
	updated_at?: string | null;
	test_mode?: boolean | null;
}

export interface ProductAttributes {
	store_id: number;
	name: string;
	slug: string;
	description?: string | null;
	status: "draft" | "published";
	status_formatted?: string | null;
	thumb_url?: string | null;
	large_thumb_url?: string | null;
	pay_what_you_want?: boolean | null;
	price?: number | null;
	price_formatted?: string | null;
	from_price?: number | null;
	from_price_formatted?: number | null;
	to_price?: number | null;
	to_price_formatted?: number | null;
	buy_now_url?: string | null;
	created_at?: string | null;
	updated_at?: string | null;
	test_mode?: boolean | null;
}

export interface VariantLink {
	title: string;
	url: string;
}

export interface VariantAttributes {
	product_id: number;
	name: string;
	slug: string;
	description?: string | null;
	status: "pending" | "draft" | "published";
	status_formatted?: string | null;
	price: number;
	is_subscription: boolean;
	interval: IntervalUnit | null;
	interval_count: number | null;
	has_free_trial: boolean;
	trial_interval: IntervalUnit | null;
	trial_interval_count: number | null;
	pay_what_you_want?: boolean | null;
	min_price?: number | null;
	suggested_price?: number | null;
	has_license_keys?: boolean | null;
	license_activation_limit?: number | null;
	is_license_limit_unlimited?: boolean | null;
	license_length_value?: number | null;
	license_length_unit?: IntervalUnit | null;
	is_license_length_unlimited?: boolean | null;
	sort?: number | null;
	links?: VariantLink[] | Record<string, string>;
	created_at?: string | null;
	updated_at?: string | null;
	test_mode?: boolean | null;
}

export interface PriceAttributes {
	variant_id: number;
	category: "one_time" | "subscription" | "lead_magnet" | "pwyw";
	scheme: "standard" | "package" | "graduated" | "volume";
	usage_aggregation?: string | null;
	unit_price?: number | null;
	unit_price_decimal?: string | number | null;
	package_size?: number | null;
	tiers?: unknown;
	renewal_interval_unit?: IntervalUnit | null;
	renewal_interval_quantity?: number | null;
	trial_interval_unit?: IntervalUnit | null;
	trial_interval_quantity?: number | null;
	min_price?: number | null;
	suggested_price?: number | null;
	tax_code?: string | null;
	setup_fee_enabled?: boolean | null;
	setup_fee?: number | null;
	created_at?: string | null;
	updated_at?: string | null;
}

export interface FileAttributes {
	variant_id?: number | null;
	identifier?: string | null;
	name?: string | null;
	extension?: string | null;
	download_url?: string | null;
	size?: number | null;
	size_formatted?: string | null;
	version?: string | null;
	sort?: number | null;
	status?: string | null;
	createdAt?: string | null;
	updatedAt?: string | null;
	test_mode?: boolean | null;
}

export interface OrderFirstItem {
	id: number;
	order_id?: number | null;
	product_id: number;
	variant_id: number;
	price_id?: number | null;
	product_name: string;
	variant_name: string;
	price: number;
	quantity?: number | null;
	test_mode?: boolean | null;
	created_at?: string | null;
	updated_at?: string | null;
}

export interface OrderAttributes {
	store_id: number;
	customer_id?: number | null;
	identifier: string;
	order_number: number;
	user_name: string;
	user_email: string;
	currency: string;
	currency_rate: string | number;
	subtotal: number;
	subtotal_usd?: number | null;
	subtotal_formatted?: string | null;
	setup_fee?: number | null;
	setup_fee_usd?: number | null;
	setup_fee_formatted?: string | null;
	discount_total: number;
	discount_total_usd?: number | null;
	discount_total_formatted?: string | null;
	tax: number;
	tax_usd?: number | null;
	tax_formatted?: string | null;
	tax_name?: string | null;
	tax_rate?: string | number | null;
	tax_inclusive?: boolean | null;
	total: number;
	total_usd?: number | null;
	total_formatted?: string | null;
	status:
		| "pending"
		| "failed"
		| "paid"
		| "refunded"
		| "fraudulent"
		| "partial_refund";
	status_formatted: string;
	refunded?: boolean | null;
	refunded_at?: string | null;
	refunded_amount?: number | null;
	refunded_amount_usd?: number | null;
	refunded_amount_formatted?: string | null;
	affiliate_id?: number | null;
	referral_amount?: number | null;
	first_order_item?: OrderFirstItem | null;
	urls?: { receipt?: string | null } | null;
	created_at?: string | null;
	updated_at?: string | null;
	test_mode?: boolean | null;
}

export interface OrderItemAttributes {
	order_id: number;
	product_id: number;
	variant_id: number;
	price_id?: number | null;
	product_name: string;
	variant_name: string;
	price: number;
	quantity: number;
	created_at?: string | null;
	updated_at?: string | null;
	test_mode?: boolean | null;
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
	created_at?: string | null;
	updated_at?: string | null;
}

export interface SubscriptionUrls {
	update_payment_method?: string | null;
	customer_portal?: string | null;
	update_customer_portal?: string | null;
	customer_portal_update_subscription?: string | null;
}

export interface SubscriptionAttributes {
	store_id: number;
	customer_id: number;
	order_id?: number | null;
	order_item_id?: number | null;
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
	payment_processor?: "stripe" | "lemonsqueezy" | "paypal" | string | null;
	pause?: SubscriptionPause | null;
	cancelled?: boolean | null;
	trial_ends_at?: string | null;
	billing_anchor?: number | null;
	first_subscription_item?: SubscriptionItemSummary | null;
	urls?: SubscriptionUrls | null;
	renews_at?: string | null;
	ends_at?: string | null;
	tax_inclusive?: boolean | null;
	created_at?: string | null;
	updated_at?: string | null;
	test_mode?: boolean | null;
}

export interface SubscriptionInvoiceAttributes {
	store_id: number;
	subscription_id: number;
	customer_id: number;
	user_name: string;
	user_email: string;
	billing_reason: "initial" | "renewal" | "updated" | string;
	card_brand?: string | null;
	card_last_four?: string | null;
	currency: string;
	currency_rate: string | number;
	status: "pending" | "paid" | "void" | "refunded" | "partial_refund";
	status_formatted: string;
	refunded: boolean;
	refunded_at: string | null;
	subtotal: number;
	subtotal_usd: number;
	subtotal_formatted: string;
	discount_total: number;
	discount_total_usd: number;
	discount_total_formatted: string;
	tax: number;
	tax_usd: number;
	tax_formatted: string;
	tax_inclusive: boolean;
	total: number;
	total_usd: number;
	total_formatted: string;
	refunded_amount: boolean | number;
	refunded_amount_usd: boolean | number;
	refunded_amount_formatted: string;
	affiliate_id?: number | null;
	referral_amount?: number | null;
	urls?: { invoice_url?: string | null } | null;
	created_at?: string | null;
	updated_at?: string | null;
	test_mode?: boolean | null;
}

export interface SubscriptionItemAttributes {
	subscription_id: number;
	price_id: number;
	quantity: number;
	is_usage_based: boolean;
	created_at?: string | null;
	updated_at?: string | null;
}

export interface UsageRecordAttributes {
	subscription_item_id: number;
	quantity: number;
	action: "increment" | "set";
	created_at?: string | null;
	updated_at?: string | null;
}

export interface DiscountAttributes {
	store_id: number;
	name: string;
	code: string;
	amount: number;
	amount_type: "percent" | "fixed";
	is_limited_to_products: boolean;
	is_limited_redemptions: boolean;
	max_redemptions: number;
	starts_at: string | null;
	expires_at: string | null;
	duration: "once" | "repeating" | "forever";
	duration_in_months?: number | null;
	status: "draft" | "published";
	status_formatted?: string | null;
	created_at?: string | null;
	updated_at?: string | null;
	test_mode?: boolean | null;
}

export interface DiscountRedemptionAttributes {
	discount_id: number;
	order_id: number;
	discount_name: string;
	discount_code: string;
	discount_amount: number;
	discount_amount_type: "percent" | "fixed";
	amount: number;
	created_at?: string | null;
	updated_at?: string | null;
}

export interface LicenseKeyAttributes {
	store_id: number;
	customer_id?: number | null;
	order_id?: number | null;
	order_item_id?: number | null;
	product_id?: number | null;
	user_name?: string | null;
	user_email?: string | null;
	key?: string | null;
	key_short: string;
	activation_limit: number | null;
	instances_count: number;
	disabled: boolean;
	status: "active" | "inactive" | "expired" | "disabled";
	status_formatted?: string | null;
	expires_at: string | null;
	created_at?: string | null;
	updated_at?: string | null;
}

export interface LicenseKeyInstanceAttributes {
	license_key_id: number;
	identifier: string;
	name: string;
	created_at?: string | null;
	updated_at?: string | null;
}

export interface CheckoutProductOptions {
	name?: string | null;
	description?: string | null;
	media?: string[] | null;
	redirect_url?: string | null;
	receipt_button_text?: string | null;
	receipt_link_url?: string | null;
	receipt_thank_you_note?: string | null;
	enabled_variants?: number[] | null;
}

export interface CheckoutOptions {
	embed?: boolean | null;
	media?: boolean | null;
	logo?: boolean | null;
	desc?: boolean | null;
	discount?: boolean | null;
	subscription_preview?: boolean | null;
	skip_trial?: boolean | null;
	dark?: boolean | null;
	background_color?: string | null;
	headings_color?: string | null;
	primary_text_color?: string | null;
	secondary_text_color?: string | null;
	links_color?: string | null;
	borders_color?: string | null;
	checkbox_color?: string | null;
	active_state_color?: string | null;
	button_color?: string | null;
	button_text_color?: string | null;
	terms_privacy_color?: string | null;
	locale?: string | null;
}

export interface CheckoutVariantQuantity {
	variant_id: number;
	quantity: number;
}

export interface CheckoutData {
	email?: string | null;
	name?: string | null;
	billing_address?: { country?: string | null; zip?: string | null } | null;
	tax_number?: string | null;
	discount_code?: string | null;
	custom?: Record<string, unknown> | null;
	variant_quantities?: CheckoutVariantQuantity[] | null;
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

export interface CheckoutAttributes {
	store_id: number;
	variant_id: number;
	custom_price?: number | null;
	product_options?: CheckoutProductOptions | null;
	checkout_options?: CheckoutOptions | null;
	checkout_data?: CheckoutData | null;
	preview?: CheckoutPreview | null;
	expires_at?: string | null;
	url?: string | null;
	created_at?: string | null;
	updated_at?: string | null;
	test_mode?: boolean | null;
}

export interface WebhookAttributes {
	store_id: number;
	url: string;
	events: string[];
	last_sent_at?: string | null;
	created_at?: string | null;
	updated_at?: string | null;
	test_mode?: boolean | null;
}

export interface AffiliateAttributes {
	store_id: number;
	user_id: number;
	user_name: string;
	user_email: string;
	share_domain: string;
	status: "active" | "pending" | "disabled";
	application_note?: string | null;
	products?: unknown;
	total_earnings: number;
	unpaid_earnings: number;
	created_at?: string | null;
	updated_at?: string | null;
}

export interface ResourceAttributes {
	users: UserAttributes;
	stores: StoreAttributes;
	customers: CustomerAttributes;
	products: ProductAttributes;
	variants: VariantAttributes;
	prices: PriceAttributes;
	files: FileAttributes;
	orders: OrderAttributes;
	"order-items": OrderItemAttributes;
	subscriptions: SubscriptionAttributes;
	"subscription-invoices": SubscriptionInvoiceAttributes;
	"subscription-items": SubscriptionItemAttributes;
	"usage-records": UsageRecordAttributes;
	discounts: DiscountAttributes;
	"discount-redemptions": DiscountRedemptionAttributes;
	"license-keys": LicenseKeyAttributes;
	"license-key-instances": LicenseKeyInstanceAttributes;
	checkouts: CheckoutAttributes;
	webhooks: WebhookAttributes;
	affiliates: AffiliateAttributes;
}

export type ResourceType = keyof ResourceAttributes;

export type ListableResource = Exclude<ResourceType, "users">;

export interface CustomerCreate {
	attributes: {
		name: string;
		email: string;
		city?: string;
		region?: string;
		country?: string;
	};
	relationships: { store: string };
}

export interface UsageRecordCreate {
	attributes: {
		quantity: number;
		action?: "increment" | "set";
	};
	relationships: { "subscription-item": string };
}

export interface DiscountCreate {
	attributes: {
		name: string;
		code: string;
		amount: number;
		amount_type: "percent" | "fixed";
		is_limited_to_products?: boolean;
		is_limited_redemptions?: boolean;
		max_redemptions?: number;
		starts_at?: string | null;
		expires_at?: string | null;
		duration?: "once" | "repeating" | "forever";
		duration_in_months?: number;
		test_mode?: boolean;
	};
	relationships: { store: string; variants?: string[] };
}

export interface CheckoutCreate {
	attributes: {
		custom_price?: number;
		product_options?: CheckoutProductOptions;
		checkout_options?: CheckoutOptions;
		checkout_data?: CheckoutData;
		preview?: boolean;
		test_mode?: boolean;
		expires_at?: string | null;
	};
	relationships: { store: string; variant: string };
}

export interface WebhookCreate {
	attributes: {
		url: string;
		events: string[];
		secret: string;
		test_mode?: boolean;
	};
	relationships: { store: string };
}

export interface CreateInput {
	customers: CustomerCreate;
	"usage-records": UsageRecordCreate;
	discounts: DiscountCreate;
	checkouts: CheckoutCreate;
	webhooks: WebhookCreate;
}

export type CreatableResource = keyof CreateInput;

export interface CustomerUpdate {
	name?: string;
	email?: string;
	city?: string;
	region?: string;
	country?: string;
	status?: "archived";
}

export interface SubscriptionUpdate {
	variant_id?: number;
	pause?: { mode: "void" | "free"; resumes_at?: string } | null;
	cancelled?: boolean;
	trial_ends_at?: string | null;
	billing_anchor?: number | null;
	invoice_immediately?: boolean;
	disable_prorations?: boolean;
}

export interface SubscriptionItemUpdate {
	quantity?: number;
	invoice_immediately?: boolean;
	disable_prorations?: boolean;
}

export interface LicenseKeyUpdate {
	activation_limit?: number | null;
	expires_at?: string | null;
	disabled?: boolean;
}

export interface WebhookUpdate {
	url?: string;
	events?: string[];
	secret?: string;
}

export interface UpdateInput {
	customers: CustomerUpdate;
	subscriptions: SubscriptionUpdate;
	"subscription-items": SubscriptionItemUpdate;
	"license-keys": LicenseKeyUpdate;
	webhooks: WebhookUpdate;
}

export type UpdatableResource = keyof UpdateInput;

export type RemovableResource = "discounts" | "webhooks";

export type RefundableResource = "orders" | "subscription-invoices";

export type InvoiceResource = "orders" | "subscription-invoices";

export type RelationshipName =
	| "store"
	| "variant"
	| "variants"
	| "subscription-item";

export interface InvoiceBilling {
	name: string;
	address: string;
	city: string;
	state?: string;
	zip_code: string;
	country: string;
	notes?: string;
	locale?: string;
}

export interface InvoiceDownload {
	meta: { urls: { download_invoice: string } };
}

export interface CurrentUsage {
	meta: {
		period_start: string;
		period_end: string;
		quantity: number;
		interval_unit: IntervalUnit;
		interval_quantity: number;
	};
}
