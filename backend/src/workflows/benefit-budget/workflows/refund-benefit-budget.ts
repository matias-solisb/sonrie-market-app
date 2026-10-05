import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { RefundOrderInput } from "../../../modules/benefit-budget/types";
import { refundBenefitBudgetStep } from "../steps";

/*

Reintegro del beneficio de un pedido anulado o rechazado. Devuelve el monto
al periodo en que se hizo la compra (aunque ese mes ya haya cerrado: el
beneficio no es acumulable). Idempotente por pedido.

Lo dispara el subscriber de `order.canceled`. En el MVP el rechazo es una
cancelación manual desde el Admin, así que usa el mismo camino; en la
Fase 4 la respuesta de SAP (`sap-orders`) llamará a este mismo workflow.

*/
export const refundBenefitBudgetWorkflow = createWorkflow(
  "refund-benefit-budget",
  function (input: RefundOrderInput) {
    return new WorkflowResponse(refundBenefitBudgetStep(input));
  }
);
