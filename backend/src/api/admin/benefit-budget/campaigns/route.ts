import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { BENEFIT_BUDGET_MODULE } from "../../../../modules/benefit-budget";
import BenefitBudgetModuleService from "../../../../modules/benefit-budget/service";
import {
  getPeriod,
  nextPeriod,
} from "../../../../modules/benefit-budget/utils/period";

/*

GET /admin/benefit-budget/campaigns — todas las campañas, la más nueva
primero, más el periodo vigente y el siguiente (hora de Santiago), para que
el Admin muestre desde cuándo rige un cambio de tope.

*/
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const service = req.scope.resolve<BenefitBudgetModuleService>(
    BENEFIT_BUDGET_MODULE
  );

  const campaigns = await service.listBenefitCampaigns(
    {},
    { order: { created_at: "DESC" } }
  );

  const periodo_actual = getPeriod();

  res.json({
    campaigns,
    periodo_actual,
    periodo_siguiente: nextPeriod(periodo_actual),
  });
};
