import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { pickupService, siteNames } from "../utils";

/*

GET /admin/pickup-scheduling/changes

Últimos 100 cambios de la agenda (auditoría), el más reciente primero, con
el usuario del Admin que hizo cada uno y el nombre del site.

*/
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const changes = await pickupService(req).listPickupScheduleChanges(
    {},
    { order: { created_at: "DESC" }, take: 100 }
  );

  const actorIds = [
    ...new Set(changes.map((c) => c.actor_id).filter(Boolean)),
  ] as string[];

  const { data: users } = actorIds.length
    ? await query.graph({
        entity: "user",
        fields: ["id", "email", "first_name", "last_name"],
        filters: { id: actorIds },
      })
    : { data: [] as any[] };

  const byId = new Map<string, any>(users.map((u: any) => [u.id, u]));
  const names = await siteNames(req);

  res.json({
    cambios: changes.map((c) => ({
      id: c.id,
      created_at: c.created_at,
      entidad: c.entidad,
      accion: c.accion,
      stock_location_id: c.stock_location_id,
      site_name: c.stock_location_id ? names.get(c.stock_location_id) ?? null : null,
      referencia: c.referencia,
      cambios: c.cambios,
      actor: c.actor_id ? byId.get(c.actor_id) ?? { id: c.actor_id, email: null } : null,
    })),
  });
};
