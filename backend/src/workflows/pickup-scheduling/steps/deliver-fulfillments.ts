import { markOrderFulfillmentAsDeliveredWorkflow } from "@medusajs/medusa/core-flows";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

export type DeliverFulfillmentsInput = {
  order_id: string;
  fulfillment_ids: string[];
};

/**
 * Marca entregados ("recogido", en un retiro) los cumplimientos del
 * pedido, con el workflow nativo de Medusa: así `fulfillment_status` queda
 * `delivered` y "Mis pedidos" muestra la fecha de entrega.
 *
 * Sin compensación: Medusa no permite deshacer una entrega. Por eso es el
 * último paso del workflow `entregar-pedido`.
 */
export const deliverFulfillmentsStep = createStep(
  "deliver-pickup-fulfillments",
  async (input: DeliverFulfillmentsInput, { container }) => {
    for (const fulfillmentId of input.fulfillment_ids) {
      await markOrderFulfillmentAsDeliveredWorkflow(container).run({
        input: {
          orderId: input.order_id,
          fulfillmentId,
          no_notification: true,
        },
      });
    }

    return new StepResponse(input.fulfillment_ids);
  }
);
