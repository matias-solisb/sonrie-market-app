import { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { PICKUP_SCHEDULING_MODULE } from "../modules/pickup-scheduling";
import PickupSchedulingModuleService from "../modules/pickup-scheduling/service";
import { RetiroActor } from "../modules/pickup-scheduling/types";

/*

Entrega con los botones nativos del Admin de Medusa ("Cumplir artículos" +
"Marcar como recogido") en vez de "Entregar": deja el cupo `retirado`
cuando el pedido quedó entregado completo (todos los ítems con
cumplimiento y todos los cumplimientos no cancelados entregados). Una
entrega parcial deja el cupo `agendado`.

La llaman dos lugares, y el que llegue primero gana:
- el subscriber de `delivery.created` (no sabe quién entregó), y
- el middleware de POST /admin/orders/:id/fulfillments/:fid/mark-as-delivered
  (sí lo sabe: el usuario del Admin de la request).

Si el subscriber llega primero, el cupo queda `retirado` sin usuario y el
middleware después completa quién entregó (`markRetirado` lo rellena solo
si estaba vacío). Si llega primero el middleware, el subscriber no hace
nada.

*/
export async function retirarSiEntregado(
  container: MedusaContainer,
  orderId: string,
  actor: RetiroActor = null
): Promise<{ booking_id: string; retirado: boolean; actor_registrado: boolean } | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const service = container.resolve<PickupSchedulingModuleService>(
    PICKUP_SCHEDULING_MODULE
  );

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

  if (!order) {
    return null;
  }

  const fulfillments = ((order as any).fulfillments ?? []).filter(
    (f: any) => f && !f.canceled_at
  );

  const entregado = new Map<string, number>();
  for (const f of fulfillments) {
    if (!f.delivered_at) {
      return null; // queda un cumplimiento sin entregar: entrega parcial
    }
    for (const fi of f.items ?? []) {
      entregado.set(
        fi.line_item_id,
        (entregado.get(fi.line_item_id) ?? 0) + Number(fi.quantity ?? 0)
      );
    }
  }

  const completo = ((order as any).items ?? []).every(
    (i: any) =>
      (entregado.get(i.id) ?? 0) >= Number(i.quantity ?? i.detail?.quantity)
  );

  if (!completo) {
    return null;
  }

  const [booking] = await service.listPickupBookings(
    { order_id: orderId },
    { take: 1 }
  );

  // Sin cupo o anulado: nada que hacer. `retirado` sigue: puede faltar
  // registrar quién entregó.
  if (!booking || (booking.estado !== "agendado" && booking.estado !== "retirado")) {
    return null;
  }

  const result = await service.markRetirado({ order_id: orderId, actor });

  return {
    booking_id: result.booking_id,
    retirado: result.retirado,
    actor_registrado: result.actor_registrado ?? false,
  };
}
