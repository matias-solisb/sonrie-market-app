import { model } from "@medusajs/framework/utils";
import { EmployeeBudget } from "./employee-budget";

/*

Movimiento del saldo de beneficio (libro de movimientos). Da trazabilidad
(qué pedido consumió cuánto) e idempotencia: no puede haber dos consumos
del mismo carrito ni dos reintegros del mismo pedido.

- `consumo`: se crea en el checkout (hook de completeCartWorkflow) con
  `cart_id`; el `order_id` se completa al crearse el pedido.
- `reintegro`: anulación/rechazo del pedido. Vuelve al periodo del pedido
  (el de su `presupuesto`), aunque ese mes ya haya cerrado.

`monto` siempre positivo, en CLP enteros; el signo lo da `tipo`.

*/
export const BenefitMovement = model
  .define("benefit_movement", {
    id: model.id({ prefix: "bmov" }).primaryKey(),
    tipo: model.enum(["consumo", "reintegro"]),
    monto: model.number(),
    cart_id: model.text().nullable(),
    order_id: model.text().nullable(),
    presupuesto: model.belongsTo(() => EmployeeBudget, {
      mappedBy: "movimientos",
    }),
  })
  .indexes([
    {
      on: ["cart_id", "tipo"],
      unique: true,
      where: "cart_id IS NOT NULL AND deleted_at IS NULL",
    },
    {
      on: ["order_id", "tipo"],
      unique: true,
      where: "order_id IS NOT NULL AND deleted_at IS NULL",
    },
  ]);
