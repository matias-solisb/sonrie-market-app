import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { BENEFIT_BUDGET_MODULE } from "../../../modules/benefit-budget";
import BenefitBudgetModuleService from "../../../modules/benefit-budget/service";
import { RefundOrderInput } from "../../../modules/benefit-budget/types";

export const refundBenefitBudgetStep = createStep(
  "refund-benefit-budget",
  async (input: RefundOrderInput, { container }) => {
    const service =
      container.resolve<BenefitBudgetModuleService>(BENEFIT_BUDGET_MODULE);

    const result = await service.refundOrder(input);

    // Solo se compensa un reintegro creado en esta ejecución.
    return new StepResponse(
      result,
      result?.created ? result.movement_id : null
    );
  },
  async (movementId: string | null, { container }) => {
    if (!movementId) {
      return;
    }

    const service =
      container.resolve<BenefitBudgetModuleService>(BENEFIT_BUDGET_MODULE);

    await service.undoRefund(movementId);
  }
);
