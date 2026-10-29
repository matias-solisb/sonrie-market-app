import {
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework";
import { MiddlewareRoute } from "@medusajs/medusa";
import { adminAnnouncementQueryConfig } from "./query-config";
import {
  AdminCreateAnnouncement,
  AdminGetAnnouncementParams,
  AdminListAnnouncementsParams,
  AdminUpdateAnnouncement,
  AdminUpdateAnnouncementSettings,
} from "./validators";

export const adminAnnouncementsMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/admin/announcements",
    middlewares: [
      validateAndTransformQuery(
        AdminListAnnouncementsParams,
        adminAnnouncementQueryConfig.list
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/announcements",
    middlewares: [
      validateAndTransformBody(AdminCreateAnnouncement),
      validateAndTransformQuery(
        AdminGetAnnouncementParams,
        adminAnnouncementQueryConfig.retrieve
      ),
    ],
  },
  // Va antes que "/admin/announcements/:id" a propósito (igual que
  // banners/reorder): la ruta estática tiene que evaluarse antes que la
  // dinámica para que "settings" no se interprete como un id.
  {
    method: ["POST"],
    matcher: "/admin/announcements/settings",
    middlewares: [validateAndTransformBody(AdminUpdateAnnouncementSettings)],
  },
  {
    method: ["GET"],
    matcher: "/admin/announcements/:id",
    middlewares: [
      validateAndTransformQuery(
        AdminGetAnnouncementParams,
        adminAnnouncementQueryConfig.retrieve
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/announcements/:id",
    middlewares: [
      validateAndTransformBody(AdminUpdateAnnouncement),
      validateAndTransformQuery(
        AdminGetAnnouncementParams,
        adminAnnouncementQueryConfig.retrieve
      ),
    ],
  },
];
