import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { BENEFIT_BUDGET_MODULE } from "../../../../../../modules/benefit-budget";
import BenefitBudgetModuleService from "../../../../../../modules/benefit-budget/service";
import { getPeriod } from "../../../../../../modules/benefit-budget/utils/period";
import { setBenefitTopeOverrideWorkflow } from "../../../../../../workflows/benefit-budget/workflows";
import { AdminSetTopeOverrideType } from "../../../validators";

/*

POST /admin/benefit-budget/customers/:customerId/override
Body: { periodo?: "YYYY-MM", tope_override: number | null }

Excepción de tope para el colaborador en el periodo (por defecto, el
vigente). `null` la quita y vuelve al tope de la campaña.

*/
export const POST = async (
  req: AuthenticatedMedusaRequest<AdminSetTopeOverrideType>,
  res: MedusaResponse
) => {
  const { customerId } = req.params;
  const periodo = req.validatedBody.periodo ?? getPeriod();

  await setBenefitTopeOverrideWorkflow(req.scope).run({
    input: {
      customer_id: customerId,
      periodo,
      tope_override: req.validatedBody.tope_override,
    },
  });

  const service = req.scope.resolve<BenefitBudgetModuleService>(
    BENEFIT_BUDGET_MODULE
  );

  res.json({
    benefit_budget: await service.getBalanceByPeriod(customerId, periodo),
  });
};
