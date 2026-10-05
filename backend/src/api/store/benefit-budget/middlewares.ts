import { MiddlewareRoute } from "@medusajs/framework";
import { authenticate } from "@medusajs/medusa";

export const storeBenefitBudgetMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/store/benefit-budget",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
];
