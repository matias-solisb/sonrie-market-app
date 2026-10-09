import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { listPickupSites } from "../../../../utils/pickup-sites";
import { pickupService } from "../utils";

/*

GET /admin/pickup-scheduling/sites

Sites de retiro con su configuración de agenda (null = usa el valor
general) y su horario semanal propio (solo los días que lo tienen). Incluye
la configuración general, para mostrar qué hereda cada site.

  {
    settings,
    sites: [{ id, name, address,
              config: { capacidad_diaria, lead_time_dias, horizonte_dias } | null,
              horario: [{ dia_semana, abierto, capacidad }] }]
  }

*/
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const service = pickupService(req);

  const sites = await listPickupSites(query);
  const ids = sites.map((s) => s.id);

  const settings = await service.getSettings();
  const configs = ids.length
    ? await service.listSiteSlotConfigs({ stock_location_id: ids })
    : [];
  const horarios = ids.length
    ? await service.listSiteSchedules({ stock_location_id: ids })
    : [];

  res.json({
    settings,
    sites: sites.map((site) => {
      const config = configs.find((c) => c.stock_location_id === site.id);

      return {
        id: site.id,
        name: site.name,
        address: site.address,
        config: config
          ? {
              capacidad_diaria: config.capacidad_diaria ?? null,
              lead_time_dias: config.lead_time_dias ?? null,
              horizonte_dias: config.horizonte_dias ?? null,
            }
          : null,
        horario: horarios
          .filter((h) => h.stock_location_id === site.id)
          .map((h) => ({
            dia_semana: h.dia_semana,
            abierto: h.abierto,
            capacidad: h.capacidad ?? null,
          }))
          .sort((a, b) => a.dia_semana - b.dia_semana),
      };
    }),
  });
};
