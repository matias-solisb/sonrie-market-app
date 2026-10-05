import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { setCartPickupSiteWorkflow } from "../../../../../workflows/pickup-site/workflows";
import { StoreSetCartPickupSiteType } from "../../validators";

/*

POST /store/carts/:id/pickup-site
Body: { stock_location_id }

Elige el site de retiro del carrito del colaborador logueado (ver
setCartPickupSiteWorkflow). Responde el carrito actualizado, el site y los
ítems sin stock suficiente en ese site:

  { cart, site, unavailable_items: [{ variant_id, title, requested, available }] }

*/
export const POST = async (
  req: AuthenticatedMedusaRequest<StoreSetCartPickupSiteType>,
  res: MedusaResponse
) => {
  const { result } = await setCartPickupSiteWorkflow(req.scope).run({
    input: {
      cart_id: req.params.id,
      customer_id: req.auth_context.actor_id,
      stock_location_id: req.validatedBody.stock_location_id,
    },
  });

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const {
    data: [cart],
  } = await query.graph({
    entity: "cart",
    fields: [
      "id",
      "email",
      "sales_channel_id",
      "metadata",
      "shipping_address.*",
      "billing_address.*",
      "shipping_methods.id",
      "shipping_methods.name",
      "shipping_methods.shipping_option_id",
      "payment_collection.payment_sessions.status",
      "total",
    ],
    filters: { id: req.params.id },
  });

  res.json({
    cart,
    site: {
      id: result.site.id,
      name: result.site.name,
      address: result.site.address,
    },
    unavailable_items: result.unavailable_items,
  });
};
