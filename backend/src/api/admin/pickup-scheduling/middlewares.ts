import {
  AuthenticatedMedusaRequest,
  MedusaNextFunction,
  MedusaResponse,
  validateAndTransformBody,
} from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { retirarSiEntregado } from "../../../utils/pickup-retiro";
import { actorOf } from "./utils";
import { MiddlewareRoute } from "@medusajs/medusa";
import {
  AdminCreatePickupException,
  AdminLoadHolidays,
  AdminSavePickupSiteAgenda,
  AdminUpdatePickupException,
  AdminUpdatePickupSettings,
  AdminUpdatePickupSite,
  AdminUpsertPickupSchedule,
} from "./validators";

// Las rutas /admin/* ya exigen usuario admin autenticado (core de Medusa).
// En el MVP cualquier usuario del Admin puede editar la agenda; el RBAC
// (solo Admin funcional y Admin plataforma) llega en la Fase 2.
/**
 * "Marcar como recogido" nativo del Admin de Medusa: cuando la entrega
 * termina bien, registra en el cupo quién entregó (el evento
 * `delivery.created` no lo trae). Corre después de responder, así que no
 * cambia ni demora la respuesta de Medusa; si falla, solo queda en el log.
 */
const registrarQuienEntrego = (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) => {
  res.on("finish", () => {
    if (res.statusCode >= 300) {
      return;
    }

    const orderId = req.params.id;
    const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);

    actorOf(req)
      .then((actor) => retirarSiEntregado(req.scope, orderId, actor))
      .then((result) => {
        if (result?.retirado || result?.actor_registrado) {
          logger.info(
            `pickup-scheduling: cupo ${result.booking_id} retirado por ${req.auth_context?.actor_id} (entrega nativa del pedido ${orderId}).`
          );
        }
      })
      .catch((e) =>
        logger.warn(
          `pickup-scheduling: no se pudo registrar quién entregó el pedido ${orderId}: ${e?.message ?? e}`
        )
      );
  });

  next();
};

export const adminPickupSchedulingMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/admin/orders/:id/fulfillments/:fulfillment_id/mark-as-delivered",
    middlewares: [registrarQuienEntrego as any],
  },
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
    matcher: "/admin/pickup-scheduling/sites/:id/agenda",
    middlewares: [validateAndTransformBody(AdminSavePickupSiteAgenda)],
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
