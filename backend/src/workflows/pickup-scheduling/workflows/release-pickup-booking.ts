import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { ReleaseBookingInput } from "../../../modules/pickup-scheduling/types";
import { releasePickupBookingStep } from "../steps";

/*

Libera el cupo de retiro de un pedido anulado o rechazado: el cupo queda
`liberado` y se descuenta de la ocupación del día, así otro colaborador
puede tomarlo. Idempotente por pedido.

Lo dispara el subscriber de `order.canceled`. En el MVP el rechazo es una
cancelación manual desde el Admin; en la Fase 4 la respuesta de SAP
(`sap-orders`) y en la Fase 2 la anulación automática por no retiro
llamarán a este mismo workflow.

*/
export const releasePickupBookingWorkflow = createWorkflow(
  "release-pickup-booking",
  function (input: ReleaseBookingInput) {
    return new WorkflowResponse(releasePickupBookingStep(input));
  }
);
