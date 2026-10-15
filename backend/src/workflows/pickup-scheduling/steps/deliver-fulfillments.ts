import { markOrderFulfillmentAsDeliveredWorkflow } from "@medusajs/medusa/core-flows";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

export type DeliverFulfillmentsInput = {
  order_id: string;
  fulfillment_ids: string[];
};

/** Mensaje al operador cuando quedó una parte entregada (ver abajo). */
export const MENSAJE_ENTREGA_PARCIAL =
  "Se entregó solo una parte del pedido. Presiona «Entregar» de nuevo para terminar la entrega.";

/**
 * Marca entregados ("recogido", en un retiro) los cumplimientos del
 * pedido, con el workflow nativo de Medusa: así `fulfillment_status` queda
 * `delivered` y "Mis pedidos" muestra la fecha de entrega.
 *
 * Sin compensación: Medusa no permite deshacer una entrega.
 *
 * - Si falla el primero (no se entregó nada): falla el paso, y el workflow
 *   deshace lo anterior (el cumplimiento recién creado).
 * - Si falla uno después de haber entregado otro (entrega parcial, 3.3):
 *   NO falla. Devuelve `pendientes` con lo que no se entregó, para que el
 *   workflow no marque el cupo y no deshaga nada (deshacer el cumplimiento
 *   creado después de una entrega deja las cantidades de Medusa
 *   inconsistentes). Un segundo "Entregar" entrega los pendientes.
 */
export const deliverFulfillmentsStep = createStep(
  "deliver-pickup-fulfillments",
  async (input: DeliverFulfillmentsInput, { container }) => {
    const entregados: string[] = [];

    for (const [i, fulfillmentId] of input.fulfillment_ids.entries()) {
      try {
        await markOrderFulfillmentAsDeliveredWorkflow(container).run({
          input: {
            orderId: input.order_id,
            fulfillmentId,
            no_notification: true,
          },
        });
      } catch (e: any) {
        if (!entregados.length) {
          throw e; // no se entregó nada: el error tal cual
        }

        const pendientes = input.fulfillment_ids.slice(i);
        container
          .resolve("logger")
          .warn(
            `pickup-scheduling: entrega parcial del pedido ${input.order_id}: entregados ${entregados.join(", ")}; pendientes ${pendientes.join(", ")}: ${e?.message ?? e}`
          );

        return new StepResponse({ entregados, pendientes });
      }

      entregados.push(fulfillmentId);
    }

    return new StepResponse({ entregados, pendientes: [] as string[] });
  }
);
