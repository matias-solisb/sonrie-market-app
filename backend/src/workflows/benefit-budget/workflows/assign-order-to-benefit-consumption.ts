import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import {
  AssignOrderToBenefitConsumptionInput,
  assignOrderToBenefitConsumptionStep,
} from "../steps";

/*

Completa el `order_id` del consumo de beneficio que se registró en el
checkout (por `cart_id`). Lo dispara el subscriber de `order.placed`.

*/
export const assignOrderToBenefitConsumptionWorkflow = createWorkflow(
  "assign-order-to-benefit-consumption",
  function (input: AssignOrderToBenefitConsumptionInput) {
    return new WorkflowResponse(assignOrderToBenefitConsumptionStep(input));
  }
);
