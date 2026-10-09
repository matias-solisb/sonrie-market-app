import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { actorOf, pickupService, requireSite, siteNames } from "../../utils";
import { AdminUpdatePickupExceptionType } from "../../validators";

/*

POST   /admin/pickup-scheduling/exceptions/:id — edita una excepción (los
       campos que no vienen no se tocan; mismas reglas que al crear).
DELETE /admin/pickup-scheduling/exceptions/:id — la elimina.

Ambos quedan auditados. 404 si no existe.

*/
export const POST = async (
  req: AuthenticatedMedusaRequest<AdminUpdatePickupExceptionType>,
  res: MedusaResponse
) => {
  const body = req.validatedBody;

  if (body.stock_location_id) {
    await requireSite(req, body.stock_location_id);
  }

  const service = pickupService(req);
  const updated = await service.updateException(req.params.id, body, await actorOf(req));
  const names = await siteNames(req);

  res.json({
    exception: {
      id: updated.id,
      fecha: updated.fecha,
      stock_location_id: updated.stock_location_id ?? null,
      site_name: updated.stock_location_id
        ? names.get(updated.stock_location_id) ?? null
        : null,
      tipo: updated.tipo,
      irrenunciable: updated.irrenunciable,
      capacidad: updated.capacidad ?? null,
      motivo: updated.motivo ?? null,
    },
  });
};

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const service = pickupService(req);

  // 404 si no existe
  await service.retrieveSiteScheduleException(req.params.id);
  await service.deleteException(req.params.id, await actorOf(req));

  res.json({ id: req.params.id, deleted: true });
};
