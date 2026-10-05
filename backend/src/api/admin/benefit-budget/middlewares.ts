import {
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework";
import { MiddlewareRoute } from "@medusajs/medusa";
import {
  AdminGetBenefitBudgetParams,
  AdminSetTopeOverride,
  AdminUpdateBenefitCampaign,
} from "./validators";

// Las rutas /admin/* ya exigen usuario admin autenticado (core de Medusa).
export const adminBenefitBudgetMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/admin/benefit-budget/customers/:customerId",
    middlewares: [validateAndTransformQuery(AdminGetBenefitBudgetParams, {})],
  },
  {
    method: ["POST"],
    matcher: "/admin/benefit-budget/customers/:customerId/override",
    middlewares: [validateAndTransformBody(AdminSetTopeOverride)],
  },
  {
    method: ["POST"],
    matcher: "/admin/benefit-budget/campaigns/:id",
    middlewares: [validateAndTransformBody(AdminUpdateBenefitCampaign)],
  },
];
