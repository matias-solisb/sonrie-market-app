import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { BENEFIT_BUDGET_MODULE } from "../../../../../modules/benefit-budget";
import BenefitBudgetModuleService from "../../../../../modules/benefit-budget/service";
import { getPeriod } from "../../../../../modules/benefit-budget/utils/period";
import { AdminGetBenefitBudgetParamsType } from "../../validators";

/*

GET /admin/benefit-budget/customers/:customerId?periodo=YYYY-MM

Saldo del colaborador en el periodo (por defecto, el vigente) y sus
movimientos de ese periodo, con el número de pedido. Lo usa el widget del
detalle de cliente en el Admin.

*/
export const GET = async (
  req: AuthenticatedMedusaRequest<unknown, AdminGetBenefitBudgetParamsType>,
  res: MedusaResponse
) => {
  const { customerId } = req.params;
  const periodo =
    (req.validatedQuery as AdminGetBenefitBudgetParamsType)?.periodo ??
    getPeriod();

  const service = req.scope.resolve<BenefitBudgetModuleService>(
    BENEFIT_BUDGET_MODULE
  );
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const campaign = await service.findActiveCampaign();

  if (!campaign) {
    res.json({ benefit_budget: null, movimientos: [] });
    return;
  }

  const balance = await service.getBalanceByPeriod(customerId, periodo);

  const movements = balance.budget_id
    ? await service.listBenefitMovements(
        { presupuesto_id: balance.budget_id },
        { order: { created_at: "DESC" } }
      )
    : [];

  const orderIds = movements
    .map((m) => m.order_id)
    .filter((id): id is string => Boolean(id));

  const { data: orders } = orderIds.length
    ? await query.graph({
        entity: "order",
        fields: ["id", "display_id"],
        filters: { id: orderIds },
      })
    : { data: [] as { id: string; display_id: number }[] };

  const displayIds = new Map<string, number>(
    orders.map((o: any) => [o.id, o.display_id] as [string, number])
  );

  res.json({
    benefit_budget: { ...balance, campaign_nombre: campaign.nombre },
    movimientos: movements.map((m) => ({
      id: m.id,
      tipo: m.tipo,
      monto: m.monto,
      order_id: m.order_id,
      order_display_id: m.order_id ? displayIds.get(m.order_id) ?? null : null,
      created_at: m.created_at,
    })),
  });
};
