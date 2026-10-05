import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { BENEFIT_BUDGET_MODULE } from "../../../../modules/benefit-budget";
import BenefitBudgetModuleService from "../../../../modules/benefit-budget/service";

// GET /admin/benefit-budget/campaigns — todas las campañas, la más nueva primero.
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

  res.json({ campaigns });
};
