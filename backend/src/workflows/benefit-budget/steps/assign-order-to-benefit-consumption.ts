import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { BENEFIT_BUDGET_MODULE } from "../../../modules/benefit-budget";
import BenefitBudgetModuleService from "../../../modules/benefit-budget/service";

export type AssignOrderToBenefitConsumptionInput = {
  order_id: string;
  cart_id: string;
};

// Sin compensación: solo completa un dato (order_id) y es idempotente.
export const assignOrderToBenefitConsumptionStep = createStep(
  "assign-order-to-benefit-consumption",
  async (input: AssignOrderToBenefitConsumptionInput, { container }) => {
    const service =
      container.resolve<BenefitBudgetModuleService>(BENEFIT_BUDGET_MODULE);

    const movementId = await service.assignOrderToConsumption(
      input.cart_id,
      input.order_id
    );

    return new StepResponse(movementId);
  }
);
