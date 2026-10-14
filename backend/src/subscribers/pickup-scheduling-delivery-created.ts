import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { PICKUP_SCHEDULING_MODULE } from "../modules/pickup-scheduling";
import PickupSchedulingModuleService from "../modules/pickup-scheduling/service";

/*

Si alguien entrega un pedido con los botones nativos del Admin de Medusa
("Cumplir artículos" + "Marcar como recogido") en vez de "Entregar", el
cupo de retiro igual queda `retirado`.

Solo cuando el pedido quedó entregado completo: todos los ítems con
cumplimiento y todos los cumplimientos (no cancelados) entregados. Una
entrega parcial deja el cupo `agendado`.

No sabe quién entregó (el evento no lo trae): `retirado_por` queda null y
el Admin lo muestra como "desde el detalle del pedido".

Idempotente: si el workflow `entregar-pedido` ya dejó el cupo `retirado`,
no hace nada.

*/
export default async function pickupSchedulingDeliveryCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const service = container.resolve<PickupSchedulingModuleService>(
    PICKUP_SCHEDULING_MODULE
  );

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

  const {
    data: [order],
  } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "items.id",
      "items.detail.quantity", // la cantidad vive en el detalle (OrderItem), no en la línea
      "fulfillments.delivered_at",
      "fulfillments.canceled_at",
      "fulfillments.items.line_item_id",
      "fulfillments.items.quantity",
    ],
    filters: { id: orderId },
  });

  const fulfillments = ((order as any)?.fulfillments ?? []).filter(
    (f: any) => f && !f.canceled_at
  );

  const entregado = new Map<string, number>();
  for (const f of fulfillments) {
    if (!f.delivered_at) {
      return; // queda un cumplimiento sin entregar: entrega parcial
    }
    for (const fi of f.items ?? []) {
      entregado.set(
        fi.line_item_id,
        (entregado.get(fi.line_item_id) ?? 0) + Number(fi.quantity ?? 0)
      );
    }
  }

  const completo = ((order as any)?.items ?? []).every(
    (i: any) =>
      (entregado.get(i.id) ?? 0) >= Number(i.quantity ?? i.detail?.quantity)
  );

  if (!completo) {
    return;
  }

  const [booking] = await service.listPickupBookings(
    { order_id: orderId },
    { take: 1 }
  );

  if (!booking || booking.estado !== "agendado") {
    return; // sin cupo, ya retirado o anulado
  }

  const result = await service.markRetirado({ order_id: orderId, actor: null });

  if (result.retirado) {
    logger.info(
      `pickup-scheduling: cupo ${result.booking_id} retirado (entrega nativa del pedido ${orderId}).`
    );
  }
}

export const config: SubscriberConfig = {
  event: "delivery.created",
};
