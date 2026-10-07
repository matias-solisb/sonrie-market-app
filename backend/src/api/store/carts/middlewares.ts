import {
  authenticate,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework";
import { MiddlewareRoute } from "@medusajs/medusa";
import { retrieveCartTransformQueryConfig } from "./query-config";
import {
  GetCartLineItemsBulkParams,
  StoreAddLineItemsBulk,
  StoreSetCartPickupDate,
  StoreSetCartPickupSite,
} from "./validators";

export const storeCartsMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/store/carts/:id/line-items/bulk",
    middlewares: [
      validateAndTransformBody(StoreAddLineItemsBulk),
      validateAndTransformQuery(
        GetCartLineItemsBulkParams,
        retrieveCartTransformQueryConfig
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/store/carts/:id/pickup-site",
    middlewares: [
      authenticate("customer", ["bearer", "session"]),
      validateAndTransformBody(StoreSetCartPickupSite),
    ],
  },
  {
    method: ["POST"],
    matcher: "/store/carts/:id/pickup-date",
    middlewares: [
      authenticate("customer", ["bearer", "session"]),
      validateAndTransformBody(StoreSetCartPickupDate),
    ],
  },
  {
    method: ["POST"],
    matcher: "/store/carts/:id/approvals",
    middlewares: [authenticate("customer", ["bearer", "session"])],
  },
];
