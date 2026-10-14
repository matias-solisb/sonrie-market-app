import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { ConfirmPickupBookingInput, confirmPickupBookingStep } from "../steps";

/*

Deja `agendado` el cupo de retiro que quedó `pendiente` en el checkout
(por `cart_id`) y le asocia el pedido. Lo dispara el subscriber de
`order.placed`.

Decisión del MVP: no hay validación SAP, así que el cupo queda agendado
apenas se crea el pedido. (El Documento técnico §6 lo confirma recién en
"Validada SAP"; en la Fase 4 esto pasará a depender de `sap-orders`.) Un
cupo anulado no se revive.

*/
export const confirmPickupBookingWorkflow = createWorkflow(
  "confirm-pickup-booking",
  function (input: ConfirmPickupBookingInput) {
    return new WorkflowResponse(confirmPickupBookingStep(input));
  }
);
