import { MiddlewareRoute } from "@medusajs/framework";
import { authenticate } from "@medusajs/medusa";

export const storePickupSlotsMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/store/pickup-slots",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
];
