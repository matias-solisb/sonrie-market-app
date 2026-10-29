import { MiddlewareRoute } from "@medusajs/medusa";
import { storeAnnouncementsMiddlewares } from "./announcements/middlewares";
import { storeApprovalsMiddlewares } from "./approvals/middlewares";
import { storeBenefitBudgetMiddlewares } from "./benefit-budget/middlewares";
import { storeCartsMiddlewares } from "./carts/middlewares";
import { storeCompaniesMiddlewares } from "./companies/middlewares";
import { storeFreeShippingMiddlewares } from "./free-shipping/middlewares";
import { storeOrdersMiddlewares } from "./orders/middlewares";
import { storePickupSlotsMiddlewares } from "./pickup-slots/middlewares";
import { storeQuotesMiddlewares } from "./quotes/middlewares";

export const storeMiddlewares: MiddlewareRoute[] = [
  ...storeCartsMiddlewares,
  ...storeAnnouncementsMiddlewares,
  ...storeCompaniesMiddlewares,
  ...storeQuotesMiddlewares,
  ...storeFreeShippingMiddlewares,
  ...storeApprovalsMiddlewares,
  ...storeOrdersMiddlewares,
  ...storeBenefitBudgetMiddlewares,
  ...storePickupSlotsMiddlewares,
];
