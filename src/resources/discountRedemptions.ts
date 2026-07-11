import type { HttpClient } from "../core/http.js";
import type { JsonApiResource } from "../core/types.js";
import type { GeneratedDiscountRedemptionAttributes } from "../generated/lemonSqueezyApiTypes.js";

export interface DiscountRedemptionAttributes extends GeneratedDiscountRedemptionAttributes {
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

export const getDiscountRedemption = async (
  http: HttpClient,
  discountRedemptionId: string | number,
): Promise<JsonApiResource<DiscountRedemptionAttributes>> => {
  return http.getResource<DiscountRedemptionAttributes>(
    `/v1/discount-redemptions/${discountRedemptionId}`,
  );
};

export const listDiscountRedemptionsForDiscount = async (
  http: HttpClient,
  discountId: string | number,
): Promise<JsonApiResource<DiscountRedemptionAttributes>[]> => {
  return http.paginate<DiscountRedemptionAttributes>("/v1/discount-redemptions", {
    "filter[discount_id]": String(discountId),
  });
};
