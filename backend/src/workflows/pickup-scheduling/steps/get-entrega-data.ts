import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { PICKUP_SCHEDULING_MODULE } from "../../../modules/pickup-scheduling";
import PickupSchedulingModuleService from "../../../modules/pickup-scheduling/service";

export type GetEntregaDataInput = { order_id: string };

export type EntregaData = {
  booking_id: string;
  /** true si el cupo ya estaba `retirado` (el workflow no hace nada). */
  ya_retirado: boolean;
  /** Site del cupo: desde ahí se entregan los productos. */
  location_id: string;
  /** Ítems que aún no tienen cumplimiento (cantidad pendiente por ítem). */
  items_por_cumplir: { id: string; quantity: number }[];
  /** Cumplimientos creados (p. ej. con "Cumplir artículos" del Admin) que aún no se entregan. */
  cumplimientos_por_entregar: string[];
};

const notAllowed = (message: string) =>
  new MedusaError(MedusaError.Types.NOT_ALLOWED, message);

/**
 * Lee el pedido y su cupo, valida que se pueda entregar y calcula qué
 * falta: ítems sin cumplimiento y cumplimientos sin entregar. Solo lee.
 */
export const getEntregaDataStep = createStep(
  "get-pickup-entrega-data",
  async ({ order_id }: GetEntregaDataInput, { container }) => {
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
        "status",
        "items.id",
        "items.detail.quantity", // la cantidad vive en el detalle (OrderItem), no en la línea
        "fulfillments.id",
        "fulfillments.delivered_at",
        "fulfillments.canceled_at",
        "fulfillments.items.line_item_id",
        "fulfillments.items.quantity",
      ],
      filters: { id: order_id },
    });

    if (!order) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `No existe el pedido ${order_id}.`
      );
    }

    const [booking] = await service.listPickupBookings(
      { order_id },
      { take: 1 }
    );

    if (!booking) {
      throw notAllowed("Este pedido no tiene fecha de retiro agendada.");
    }

    if (booking.estado === "retirado") {
      return new StepResponse<EntregaData>({
        booking_id: booking.id,
        ya_retirado: true,
        location_id: booking.stock_location_id,
        items_por_cumplir: [],
        cumplimientos_por_entregar: [],
      });
    }

    if (order.status === "canceled" || booking.estado === "anulado") {
      throw notAllowed("Este pedido está anulado: no se puede entregar.");
    }

    if (booking.estado !== "agendado") {
      throw notAllowed(
        "Este pedido todavía se está creando. Intenta en unos segundos."
      );
    }

    // F1: con el paso "Listo para retiro", también aceptar `preparado`.

    const fulfillments = ((order as any).fulfillments ?? []).filter(
      (f: any) => f && !f.canceled_at
    );

    const cumplido = new Map<string, number>();
    for (const f of fulfillments) {
      for (const fi of f.items ?? []) {
        cumplido.set(
          fi.line_item_id,
          (cumplido.get(fi.line_item_id) ?? 0) + Number(fi.quantity ?? 0)
        );
      }
    }

    const items_por_cumplir = ((order as any).items ?? [])
      .map((i: any) => {
        const cantidad = Number(i.quantity ?? i.detail?.quantity);
        // Sin cantidad no se puede saber qué falta: mejor fallar que
        // marcar entregado un pedido sin crear su cumplimiento.
        if (!Number.isFinite(cantidad)) {
          throw new MedusaError(
            MedusaError.Types.UNEXPECTED_STATE,
            `No se pudo leer la cantidad del ítem ${i.id} del pedido ${order_id}.`
          );
        }
        return {
          id: i.id as string,
          quantity: cantidad - (cumplido.get(i.id) ?? 0),
        };
      })
      .filter((i: { quantity: number }) => i.quantity > 0);

    return new StepResponse<EntregaData>({
      booking_id: booking.id,
      ya_retirado: false,
      location_id: booking.stock_location_id,
      items_por_cumplir,
      cumplimientos_por_entregar: fulfillments
        .filter((f: any) => !f.delivered_at)
        .map((f: any) => f.id as string),
    });
  }
);
