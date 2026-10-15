import {
  acquireLockStep,
  createOrderFulfillmentWorkflow,
  releaseLockStep,
} from "@medusajs/medusa/core-flows";
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

  0. Bloqueo por pedido: dos clics a la vez se atienden uno después del
     otro (el segundo ve el pedido ya entregado y no hace nada).
  1. Lee el pedido y su cupo, y valida que se pueda entregar
     (no anulado, con cupo agendado).
  2. Crea el cumplimiento de los ítems que falten,
     desde el site del cupo.                          (compensable)
     F1: este paso es "Preparar pedido / Listo para retiro". Cuando exista
     el estado `preparado`, se separa en su propio workflow y botón, y
     este workflow solo entrega lo ya preparado.
  3. Marca entregados los cumplimientos pendientes
     (nativo de Medusa: `fulfillment_status` = delivered). Irreversible.
  4. Cupo → `retirado`, con cuándo y quién. Solo si se entregó todo.

Por qué el cupo va al final (3.3, entrega parcial): Medusa no permite
deshacer una entrega, y deshacer el paso 2 después de una entrega deja el
pedido de Medusa con cantidades que no calzan (no se puede volver a
cumplir). Así que, si el paso 3 entrega una parte y falla el resto, el
workflow NO falla: no deshace nada, deja el cupo `agendado` y devuelve
`parcial: true`; la ruta responde un error que le dice al operador que
presione "Entregar" de nuevo. Ese segundo clic encuentra los cumplimientos
pendientes, los entrega y recién ahí deja el cupo `retirado`. Si el paso 3
falla sin haber entregado nada, el workflow falla y deshace el paso 2
(caso limpio: se puede reintentar).

Si el admin ya había usado "Cumplir artículos", el paso 2 no crea nada y el
3 entrega ese cumplimiento. Si alguien usa "Marcar como recogido" nativo,
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
    const lockKey = transform({ input }, ({ input }) => `pickup-entregar:${input.order_id}`);
    acquireLockStep({ key: lockKey, timeout: 30, ttl: 120 });

    const data = getEntregaDataStep({ order_id: input.order_id });

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

    const entrega = deliverFulfillmentsStep(porEntregar);

    const retiro = when(
      "retirar-si-se-entrego-todo",
      { data, entrega },
      ({ data, entrega }) => !data.ya_retirado && entrega.pendientes.length === 0
    ).then(() =>
      markRetiradoStep(
        transform({ input }, ({ input }) => ({
          order_id: input.order_id,
          actor: input.actor ?? null,
        }))
      )
    );

    releaseLockStep({ key: lockKey });

    return new WorkflowResponse(
      transform({ data, retiro, entrega }, ({ data, retiro, entrega }) => ({
        booking_id: data.booking_id,
        /** false si ya estaba entregado (no se hizo nada) o si quedó a medias. */
        entregado_ahora: !data.ya_retirado && !!retiro?.retirado,
        /** true si se entregó una parte y falta presionar "Entregar" de nuevo. */
        parcial: entrega.pendientes.length > 0,
      }))
    );
  }
);
