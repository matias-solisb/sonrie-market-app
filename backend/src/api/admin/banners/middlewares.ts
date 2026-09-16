import {
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework";
import { MiddlewareRoute } from "@medusajs/medusa";
import { adminBannerQueryConfig } from "./query-config";
import {
  AdminCreateBanner,
  AdminGetBannerParams,
  AdminReorderBanners,
  AdminUpdateBanner,
} from "./validators";

export const adminBannersMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/admin/banners",
    middlewares: [
      validateAndTransformQuery(
        AdminGetBannerParams,
        adminBannerQueryConfig.list
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/banners",
    middlewares: [
      validateAndTransformBody(AdminCreateBanner),
      validateAndTransformQuery(
        AdminGetBannerParams,
        adminBannerQueryConfig.retrieve
      ),
    ],
  },
  // Va antes que "/admin/banners/:id" a propósito: la ruta estática
  // (reorder) tiene que evaluarse antes que la dinámica ([id]) para que
  // "reorder" no se interprete como un id de banner.
  {
    method: ["POST"],
    matcher: "/admin/banners/reorder",
    middlewares: [validateAndTransformBody(AdminReorderBanners)],
  },
  {
    method: ["POST"],
    matcher: "/admin/banners/:id",
    middlewares: [
      validateAndTransformBody(AdminUpdateBanner),
      validateAndTransformQuery(
        AdminGetBannerParams,
        adminBannerQueryConfig.retrieve
      ),
    ],
  },
];
