import { model } from "@medusajs/framework/utils";

/*

Cupo de retiro de un pedido (Documento técnico §6–7, `PickupBooking`).

Estados: reservado → confirmado → liberado.
- `reservado`: se crea en el checkout (hook de completeCartWorkflow) con
  `cart_id`.
- `confirmado`: al crearse el pedido (subscriber `order.placed`) se
  completa `order_id`. En el MVP no hay validación SAP, así que se confirma
  de inmediato.
- `liberado`: anulación/rechazo del pedido. Devuelve el cupo.

`bloque` null en el MVP. El historial de reagendamientos llega en F2 (2b).

*/
export const PickupBooking = model
  .define("pickup_booking", {
    id: model.id({ prefix: "pkbk" }).primaryKey(),
    cart_id: model.text(),
    order_id: model.text().nullable(),
    stock_location_id: model.text(),
    fecha: model.text(),
    bloque: model.text().nullable(),
    estado: model
      .enum(["reservado", "confirmado", "liberado"])
      .default("reservado"),
  })
  .indexes([
    {
      on: ["cart_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      on: ["order_id"],
      unique: true,
      where: "order_id IS NOT NULL AND deleted_at IS NULL",
    },
    {
      on: ["stock_location_id", "fecha"],
    },
  ]);
