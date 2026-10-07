import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { ConfirmPickupBookingInput, confirmPickupBookingStep } from "../steps";

/*

Confirma el cupo de retiro reservado en el checkout (por `cart_id`) y le
asocia el pedido. Lo dispara el subscriber de `order.placed`.

En el MVP no hay validación SAP: el cupo pasa de `reservado` a
`confirmado` apenas se crea el pedido (Documento técnico §6). Un cupo ya
liberado no se revive.

*/
export const confirmPickupBookingWorkflow = createWorkflow(
  "confirm-pickup-booking",
  function (input: ConfirmPickupBookingInput) {
    return new WorkflowResponse(confirmPickupBookingStep(input));
  }
);
