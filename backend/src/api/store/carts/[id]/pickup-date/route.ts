import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { setCartPickupDateWorkflow } from "../../../../../workflows/pickup-scheduling/workflows";
import { StoreSetCartPickupDateType } from "../../validators";

/*

POST /store/carts/:id/pickup-date
Body: { fecha: "YYYY-MM-DD" }

Guarda la fecha de retiro del carrito del colaborador logueado (ver
setCartPickupDateWorkflow). Valida que el carrito tenga site y que la
fecha tenga cupo, pero no reserva el cupo: eso ocurre al confirmar el
pedido.

  { cart, pickup_date: { stock_location_id, fecha } }

*/
export const POST = async (
  req: AuthenticatedMedusaRequest<StoreSetCartPickupDateType>,
  res: MedusaResponse
) => {
  const { result } = await setCartPickupDateWorkflow(req.scope).run({
    input: {
      cart_id: req.params.id,
      customer_id: req.auth_context.actor_id,
      fecha: req.validatedBody.fecha,
    },
  });

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const {
    data: [cart],
  } = await query.graph({
    entity: "cart",
    fields: ["id", "metadata", "sales_channel_id", "total"],
    filters: { id: req.params.id },
  });

  res.json({ cart, pickup_date: result });
};
