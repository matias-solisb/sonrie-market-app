import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { releasePickupBookingWorkflow } from "../workflows/pickup-scheduling/workflows";

/*

Al anularse un pedido, libera su cupo de retiro para que otro colaborador
pueda tomarlo. Idempotente: si el evento llega dos veces, la segunda no
hace nada.

Se pasa también el `cart_id` por si el subscriber de `order.placed` aún no
alcanzó a asociar el cupo con el pedido. Va separado del subscriber de
benefit-budget: si uno falla, el otro corre igual.

*/
export default async function pickupSchedulingOrderCanceledHandler({
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

  const { result } = await releasePickupBookingWorkflow(container).run({
    input: { order_id: data.id, cart_id: (order as any)?.cart?.id ?? null },
  });

  if (result?.released) {
    logger.info(
      `pickup-scheduling: cupo ${result.booking_id} liberado por anulación del pedido ${data.id}.`
    );
  }
}

export const config: SubscriberConfig = {
  event: "order.canceled",
};
