import {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { defineMiddlewares } from "@medusajs/medusa";
import { adminMiddlewares } from "./admin/middlewares";
import { quotesDisabledMiddlewares } from "./middlewares/quotes-disabled";
import { storeMiddlewares } from "./store/middlewares";

export default defineMiddlewares({
  routes: [
    // Primero: apaga /store/quotes y /admin/quotes (ver quotes-disabled.ts)
    ...quotesDisabledMiddlewares,
    ...adminMiddlewares,
    ...storeMiddlewares,
    {
      matcher: "/store/customers/me",
      middlewares: [
        (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
          req.allowed = ["employee"];
          next();
        },
      ],
    },
  ],
});
