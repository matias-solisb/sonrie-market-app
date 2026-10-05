import { Module } from "@medusajs/framework/utils";
import BenefitBudgetModuleService from "./service";

export const BENEFIT_BUDGET_MODULE = "benefit_budget";

export default Module(BENEFIT_BUDGET_MODULE, {
  service: BenefitBudgetModuleService,
});
