import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { BENEFIT_BUDGET_MODULE } from "../../../modules/benefit-budget";
import BenefitBudgetModuleService from "../../../modules/benefit-budget/service";

/*

GET /store/benefit-budget — saldo de beneficio del colaborador logueado en
el periodo vigente (hora de Santiago).

Respuesta:
  { benefit_budget: { periodo, tope, consumido, disponible, ... } }
  { benefit_budget: null }  si no hay campaña activa.

*/
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const service = req.scope.resolve<BenefitBudgetModuleService>(
    BENEFIT_BUDGET_MODULE
  );

  const campaign = await service.findActiveCampaign();

  if (!campaign) {
    res.json({ benefit_budget: null });
    return;
  }

  const balance = await service.getBalance(req.auth_context.actor_id);

  res.json({
    benefit_budget: {
      periodo: balance.periodo,
      tope: balance.tope,
      consumido: balance.consumido,
      disponible: balance.disponible,
      campaign: { id: campaign.id, nombre: campaign.nombre },
    },
  });
};
