import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { updateCartWorkflow } from "@medusajs/medusa/core-flows";
import {
  prepareCartPickupDateStep,
  PrepareCartPickupDateInput,
} from "../steps";

/*

Guarda la fecha de retiro del carrito (`metadata.pickup_date`,
"YYYY-MM-DD"). Lo usa POST /store/carts/:id/pickup-date.

1. Valida carrito, site y que la fecha tenga cupo hoy (sin reservarlo).
2. Escribe `metadata.pickup_date`. Medusa fusiona la metadata, así que el
   resto de las claves (stock_location_id, company_id…) se conservan.

El cupo se reserva al confirmar el pedido (hook validate-cart-completion).
Si se cambia el site del carrito, POST /store/carts/:id/pickup-site borra
la fecha (prepare-cart-pickup-site).

*/
export const setCartPickupDateWorkflow = createWorkflow(
  "set-cart-pickup-date",
  function (input: PrepareCartPickupDateInput) {
    const prepared = prepareCartPickupDateStep(input);

    const cartUpdate = transform(
      { prepared },
      ({ prepared }) => prepared.cart_update
    );

    updateCartWorkflow.runAsStep({ input: cartUpdate });

    const result = transform({ prepared }, ({ prepared }) => ({
      stock_location_id: prepared.stock_location_id,
      fecha: prepared.fecha,
    }));

    return new WorkflowResponse(result);
  }
);
