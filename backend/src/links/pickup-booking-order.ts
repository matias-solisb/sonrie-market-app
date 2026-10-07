import { defineLink } from "@medusajs/framework/utils";
import OrderModule from "@medusajs/medusa/order";
import PickupSchedulingModule from "../modules/pickup-scheduling";

/*

Link de solo lectura: PickupBooking.order_id -> Order.

Sin tabla pivote. Permite `pickup_booking.order` en `query.graph` (backoffice
del operador y Admin). El `order_id` se completa cuando se crea el pedido
(subscriber `order.placed`).

*/
export default defineLink(
  {
    linkable: PickupSchedulingModule.linkable.pickupBooking,
    field: "order_id",
  },
  OrderModule.linkable.order,
  { readOnly: true }
);
