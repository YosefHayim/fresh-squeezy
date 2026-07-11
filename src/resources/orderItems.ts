import type { HttpClient } from "../core/http.js";
import type { JsonApiResource } from "../core/types.js";
import type { GeneratedOrderItemAttributes } from "../generated/lemonSqueezyApiTypes.js";

/**
 * Order item attributes. `quantity` was added to the documented object in
 * the 2024-12-06 changelog and is needed for multi-quantity reconciliation.
 */
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

export const getOrderItem = async (
  http: HttpClient,
  orderItemId: string | number,
): Promise<JsonApiResource<OrderItemAttributes>> => {
  return http.getResource<OrderItemAttributes>(`/v1/order-items/${orderItemId}`);
};

export const listOrderItemsForOrder = async (
  http: HttpClient,
  orderId: string | number,
): Promise<JsonApiResource<OrderItemAttributes>[]> => {
  return http.paginate<OrderItemAttributes>("/v1/order-items", {
    "filter[order_id]": String(orderId),
  });
};
