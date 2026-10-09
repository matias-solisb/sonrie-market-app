import { validateAndTransformBody } from "@medusajs/framework";
import { MiddlewareRoute } from "@medusajs/medusa";
import {
  AdminCreatePickupException,
  AdminLoadHolidays,
  AdminUpdatePickupException,
  AdminUpdatePickupSettings,
  AdminUpdatePickupSite,
  AdminUpsertPickupSchedule,
} from "./validators";

// Las rutas /admin/* ya exigen usuario admin autenticado (core de Medusa).
// En el MVP cualquier usuario del Admin puede editar la agenda; el RBAC
// (solo Admin funcional y Admin plataforma) llega en la Fase 2.
export const adminPickupSchedulingMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/admin/pickup-scheduling/settings",
    middlewares: [validateAndTransformBody(AdminUpdatePickupSettings)],
  },
  {
    method: ["POST"],
    matcher: "/admin/pickup-scheduling/sites/:id",
    middlewares: [validateAndTransformBody(AdminUpdatePickupSite)],
  },
  {
    method: ["POST"],
    matcher: "/admin/pickup-scheduling/sites/:id/horario/:dia",
    middlewares: [validateAndTransformBody(AdminUpsertPickupSchedule)],
  },
  {
    method: ["POST"],
    matcher: "/admin/pickup-scheduling/exceptions",
    middlewares: [validateAndTransformBody(AdminCreatePickupException)],
  },
  {
    method: ["POST"],
    matcher: "/admin/pickup-scheduling/exceptions/:id",
    middlewares: [validateAndTransformBody(AdminUpdatePickupException)],
  },
  {
    method: ["POST"],
    matcher: "/admin/pickup-scheduling/feriados",
    middlewares: [validateAndTransformBody(AdminLoadHolidays)],
  },
];
