import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { BENEFIT_BUDGET_MODULE } from "../../../../../../modules/benefit-budget";
import BenefitBudgetModuleService from "../../../../../../modules/benefit-budget/service";

/*

GET /admin/benefit-budget/campaigns/:id/cambios

Historial de cambios de la campaña (auditoría), el más reciente primero,
con el usuario del Admin que hizo cada uno. Lo usa la página "Beneficio".

*/
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const service = req.scope.resolve<BenefitBudgetModuleService>(
    BENEFIT_BUDGET_MODULE
  );
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  // 404 si la campaña no existe
  await service.retrieveBenefitCampaign(req.params.id);

  const changes = await service.listBenefitCampaignChanges(
    { campaign_id: req.params.id },
    { order: { created_at: "DESC" }, take: 100 }
  );

  const actorIds = [
    ...new Set(changes.map((c) => c.actor_id).filter(Boolean)),
  ] as string[];

  const { data: users } = actorIds.length
    ? await query.graph({
        entity: "user",
        fields: ["id", "email", "first_name", "last_name"],
        filters: { id: actorIds },
      })
    : { data: [] as any[] };

  const byId = new Map<string, any>(
    users.map((u: any) => [u.id, u] as [string, any])
  );

  res.json({
    cambios: changes.map((c) => ({
      id: c.id,
      created_at: c.created_at,
      cambios: c.cambios,
      rige_desde: c.rige_desde,
      actor: c.actor_id
        ? byId.get(c.actor_id) ?? { id: c.actor_id, email: null }
        : null,
    })),
  });
};
