import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { findUnavailableItems } from "../../../utils/pickup-sites";

/*

Lista los ítems del carrito sin stock suficiente en el site (su sales
channel). No lanza error: el storefront avisa al colaborador y el checkout
vuelve a validarlo al completar el carrito.

*/
export const findUnavailableCartItemsStep = createStep(
  "find-unavailable-cart-items",
  async (input: { cart_id: string; sales_channel_id: string }, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    const {
      data: [cart],
    } = await query.graph({
      entity: "cart",
      fields: [
        "items.variant_id",
        "items.title",
        "items.product_title",
        "items.quantity",
        "items.variant.manage_inventory",
        "items.variant.allow_backorder",
      ],
      filters: { id: input.cart_id },
    });

    const items = (cart?.items ?? []).filter(Boolean).map((item: any) => ({
      ...item,
      title: item.product_title || item.title,
    }));

    return new StepResponse(
      await findUnavailableItems(query, items, input.sales_channel_id)
    );
  }
);
