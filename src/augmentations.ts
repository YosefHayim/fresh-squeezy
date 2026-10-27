import type {
  GeneratedLemonSqueezyFieldMap,
  GeneratedLemonSqueezyResourceName,
} from "./generated/lemonSqueezyApiTypes.js";


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
  status?: "pending" | "failed" | "paid" | "refunded" | "fraudulent" | "partial_refund";
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

export interface LatestOrderItemFields {
  quantity?: number;
}

export interface LatestVariantFields {
  links?: Array<{ title: string; url: string }> | Record<string, string>;
}

export interface LatestPriceFields {
  setup_fee_enabled?: boolean | null;
  setup_fee?: number | null;
  unit_price_decimal?: string | null;
}

export interface LatestCheckoutOptionsFields {
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
}

export interface LatestCheckoutDataFields {
  variant_quantities?: Array<{ variant_id: number; quantity: number }>;
}

export interface LatestCheckoutFields {
  checkout_options?: LatestCheckoutOptionsFields & Record<string, unknown>;
  checkout_data?: LatestCheckoutDataFields & Record<string, unknown>;
}

export interface LatestSubscriptionItemUpdateFields {
  invoice_immediately?: boolean;
  disable_prorations?: boolean;
}

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

export type WithLatestLemonSqueezyFields<T, R extends LatestLemonSqueezyResourceName> = T &
  LatestFieldsFor<R>;
