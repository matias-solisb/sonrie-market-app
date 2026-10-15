import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { MedusaError } from "@medusajs/framework/utils";
import { entregarPedidoWorkflow } from "../../../../../../workflows/pickup-scheduling/workflows";
import { MENSAJE_ENTREGA_PARCIAL } from "../../../../../../workflows/pickup-scheduling/steps/deliver-fulfillments";
import { toFecha } from "../../../../../../modules/pickup-scheduling/utils/fecha";
import { actorOf, pickupService, siteNames } from "../../../utils";
import { toRetiros } from "../../helpers";

/*

POST /admin/pickup-scheduling/retiros/:order_id/entregar

Entrega el pedido (workflow `entregar-pedido`): cupo `retirado` con
cuándo y quién, y cumplimiento de Medusa creado y marcado entregado.

  { retiro: Retiro, entregado_ahora: boolean }

`entregado_ahora` es false si ya estaba entregado (doble clic): responde
200 igual, con la hora y el usuario de la primera entrega.
Errores (400/404): pedido anulado, sin fecha de retiro o aún creándose.
500 con MENSAJE_ENTREGA_PARCIAL: se entregó una parte (ver workflow); el
operador vuelve a presionar "Entregar" y termina.

*/
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const orderId = req.params.order_id;
  const actor = await actorOf(req);

  const { result } = await entregarPedidoWorkflow(req.scope).run({
    input: { order_id: orderId, actor },
  });

  if (result.parcial) {
    throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, MENSAJE_ENTREGA_PARCIAL);
  }

  const bookings = await pickupService(req).listPickupBookings(
    { id: result.booking_id },
    { take: 1 }
  );
  const [retiro] = await toRetiros(
    req,
    bookings as any,
    await siteNames(req),
    toFecha()
  );

  res.json({ retiro, entregado_ahora: result.entregado_ahora });
};
