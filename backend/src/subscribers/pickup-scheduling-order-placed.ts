import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { confirmPickupBookingWorkflow } from "../workflows/pickup-scheduling/workflows";

/*

Al crearse un pedido, confirma su cupo de retiro (reservado en el checkout
por `cart_id`) y le asocia el pedido. Así el backoffice ve qué pedido
ocupa cada cupo y la anulación lo encuentra por `order_id`.

Va separado del subscriber de benefit-budget: si uno falla, el otro corre
igual.

*/
export default async function pickupSchedulingOrderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  const {
    data: [order],
  } = await query.graph({
    entity: "order",
    fields: ["id", "cart.id"],
    filters: { id: data.id },
  });

  const cartId = (order as any)?.cart?.id;

  if (!cartId) {
    return;
  }

  const { result: bookingId } = await confirmPickupBookingWorkflow(
    container
  ).run({
    input: { order_id: data.id, cart_id: cartId },
  });

  if (!bookingId) {
    logger.warn(
      `pickup-scheduling: el pedido ${data.id} no tiene cupo de retiro (carrito ${cartId}).`
    );
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
};
