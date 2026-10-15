import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { retirarSiEntregado } from "../utils/pickup-retiro";

/*

Si alguien entrega un pedido con los botones nativos del Admin de Medusa
("Cumplir artículos" + "Marcar como recogido") en vez de "Entregar", el
cupo de retiro igual queda `retirado` (ver utils/pickup-retiro.ts).

El evento no trae quién entregó: lo registra el middleware de
"mark-as-delivered" (api/admin/middlewares.ts). Si este subscriber llega
primero, el cupo queda `retirado` sin usuario y el middleware lo completa.

Idempotente: si el workflow `entregar-pedido` ya dejó el cupo `retirado`,
no hace nada.

*/
export default async function pickupSchedulingDeliveryCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  const {
    data: [fulfillment],
  } = await query.graph({
    entity: "fulfillment",
    fields: ["id", "order.id"],
    filters: { id: data.id },
  });

  const orderId = (fulfillment as any)?.order?.id as string | undefined;

  if (!orderId) {
    return;
  }

  const result = await retirarSiEntregado(container, orderId);

  if (result?.retirado) {
    logger.info(
      `pickup-scheduling: cupo ${result.booking_id} retirado (entrega nativa del pedido ${orderId}).`
    );
  }
}

export const config: SubscriberConfig = {
  event: "delivery.created",
};
