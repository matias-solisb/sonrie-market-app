import { MiddlewareRoute } from "@medusajs/medusa";
import { adminCompaniesMiddlewares } from "./companies/middlewares";
import { adminQuotesMiddlewares } from "./quotes/middlewares";
import { adminApprovalsMiddlewares } from "./approvals/middlewares";
import { adminBannersMiddlewares } from "./banners/middlewares";
import { adminAnnouncementsMiddlewares } from "./announcements/middlewares";
import { adminBenefitBudgetMiddlewares } from "./benefit-budget/middlewares";
import { adminPickupSchedulingMiddlewares } from "./pickup-scheduling/middlewares";
import { adminColaboradoresMiddlewares } from "./colaboradores/middlewares";

export const adminMiddlewares: MiddlewareRoute[] = [
  ...adminCompaniesMiddlewares,
  ...adminQuotesMiddlewares,
  ...adminApprovalsMiddlewares,
  ...adminBannersMiddlewares,
  ...adminAnnouncementsMiddlewares,
  ...adminBenefitBudgetMiddlewares,
  ...adminPickupSchedulingMiddlewares,
  ...adminColaboradoresMiddlewares,
];
