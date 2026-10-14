import { createOrderFulfillmentWorkflow } from "@medusajs/medusa/core-flows";
import {
  createWorkflow,
  transform,
  when,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { RetiroActor } from "../../../modules/pickup-scheduling/types";
import {
  deliverFulfillmentsStep,
  getEntregaDataStep,
  markRetiradoStep,
} from "../steps";

/*

Entrega un pedido en la sala de venta: el botón "Entregar" de "Retiros del
día" y el de "Marcar como entregado" del widget del pedido.

Reemplaza los dos pasos nativos del Admin de Medusa ("Cumplir artículos" y
"Marcar como recogido") por una sola acción:

  1. Lee el pedido y su cupo, y valida que se pueda entregar
     (no anulado, con cupo agendado).
  2. Cupo → `retirado`, con cuándo y quién.          (compensable)
  3. Crea el cumplimiento de los ítems que falten,
     desde el site del cupo.                          (compensable)
     F1: este paso es "Preparar pedido / Listo para retiro". Cuando exista
     el estado `preparado`, se separa en su propio workflow y botón, y
     este workflow solo entrega lo ya preparado.
  4. Marca entregados los cumplimientos pendientes
     (nativo de Medusa: `fulfillment_status` = delivered). Es irreversible,
     por eso va al final.

Si el admin ya había usado "Cumplir artículos", el paso 3 no crea nada y el
4 entrega ese cumplimiento. Si alguien usa "Marcar como recogido" nativo,
el subscriber de `delivery.created` deja el cupo `retirado` igual.

Idempotente: si el cupo ya estaba `retirado` no hace nada (doble clic).

*/
export type EntregarPedidoInput = {
  order_id: string;
  /** Usuario del Admin que entrega (id y correo). */
  actor?: RetiroActor;
};

export const entregarPedidoWorkflowId = "entregar-pedido";

export const entregarPedidoWorkflow = createWorkflow(
  entregarPedidoWorkflowId,
  function (input: EntregarPedidoInput) {
    const data = getEntregaDataStep({ order_id: input.order_id });

    const retiro = markRetiradoStep(
      transform({ input }, ({ input }) => ({
        order_id: input.order_id,
        actor: input.actor ?? null,
      }))
    );

    // F1: mover a `prepararPedidoWorkflow` (estado `preparado`).
    const creado = when(
      "crear-cumplimiento-retiro",
      { data },
      ({ data }) => !data.ya_retirado && data.items_por_cumplir.length > 0
    ).then(() =>
      createOrderFulfillmentWorkflow.runAsStep({
        input: transform({ input, data }, ({ input, data }) => ({
          order_id: input.order_id,
          items: data.items_por_cumplir,
          location_id: data.location_id,
          created_by: input.actor?.id ?? undefined,
          no_notification: true,
        })),
      })
    );

    const porEntregar = transform({ input, data, creado }, ({ input, data, creado }) => ({
      order_id: input.order_id,
      fulfillment_ids: data.ya_retirado
        ? []
        : [
            ...data.cumplimientos_por_entregar,
            ...(creado?.id ? [creado.id as string] : []),
          ],
    }));

    deliverFulfillmentsStep(porEntregar);

    return new WorkflowResponse(
      transform({ data, retiro }, ({ data, retiro }) => ({
        booking_id: data.booking_id,
        /** false si ya estaba entregado (no se hizo nada). */
        entregado_ahora: !data.ya_retirado && retiro.retirado,
      }))
    );
  }
);
