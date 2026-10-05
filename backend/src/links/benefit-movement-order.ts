import { defineLink } from "@medusajs/framework/utils";
import OrderModule from "@medusajs/medusa/order";
import BenefitBudgetModule from "../modules/benefit-budget";

/*

Link de solo lectura: BenefitMovement.order_id -> Order.

Sin tabla pivote. Permite `benefit_movement.order` en `query.graph` (p. ej.
para el detalle de movimientos en el Admin). El `order_id` se completa
cuando se crea el pedido (subscriber `order.placed`, paso 6).

*/
export default defineLink(
  {
    linkable: BenefitBudgetModule.linkable.benefitMovement,
    field: "order_id",
  },
  OrderModule.linkable.order,
  { readOnly: true }
);
