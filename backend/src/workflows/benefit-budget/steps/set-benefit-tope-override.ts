import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { BENEFIT_BUDGET_MODULE } from "../../../modules/benefit-budget";
import BenefitBudgetModuleService from "../../../modules/benefit-budget/service";
import { SetTopeOverrideInput } from "../../../modules/benefit-budget/types";

export const setBenefitTopeOverrideStep = createStep(
  "set-benefit-tope-override",
  async (input: SetTopeOverrideInput, { container }) => {
    const service =
      container.resolve<BenefitBudgetModuleService>(BENEFIT_BUDGET_MODULE);

    const { budget_id, previous } = await service.setTopeOverride(input);

    return new StepResponse(budget_id, { ...input, tope_override: previous });
  },
  async (previous: SetTopeOverrideInput | undefined, { container }) => {
    if (!previous) {
      return;
    }

    const service =
      container.resolve<BenefitBudgetModuleService>(BENEFIT_BUDGET_MODULE);

    await service.setTopeOverride(previous);
  }
);
