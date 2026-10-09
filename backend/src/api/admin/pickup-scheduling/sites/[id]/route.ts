import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { actorOf, pickupService, requireSite } from "../../utils";
import { AdminUpdatePickupSiteType } from "../../validators";

/*

POST /admin/pickup-scheduling/sites/:id

Capacidad diaria, lead-time y horizonte propios del site. null = usar el
valor general; un campo que no viene no se toca. Queda auditado.

*/
export const POST = async (
  req: AuthenticatedMedusaRequest<AdminUpdatePickupSiteType>,
  res: MedusaResponse
) => {
  const site = await requireSite(req, req.params.id);

  const config = await pickupService(req).upsertSiteSlotConfig(
    { stock_location_id: site.id, ...req.validatedBody },
    await actorOf(req)
  );

  res.json({
    config: {
      capacidad_diaria: config.capacidad_diaria ?? null,
      lead_time_dias: config.lead_time_dias ?? null,
      horizonte_dias: config.horizonte_dias ?? null,
    },
  });
};
