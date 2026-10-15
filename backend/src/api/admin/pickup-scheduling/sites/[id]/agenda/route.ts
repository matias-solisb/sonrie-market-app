import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { actorOf, pickupService, requireSite } from "../../../utils";
import { AdminSavePickupSiteAgendaType } from "../../../validators";

/*

POST /admin/pickup-scheduling/sites/:id/agenda

Guarda de una vez el panel "Agenda de {site}" del Admin, en una sola
transacción: o queda todo o no queda nada.

  {
    config?:  { capacidad_diaria?, lead_time_dias?, horizonte_dias? }
              (null = usar el valor general; lo que no viene no se toca)
    horario?: [{ dia_semana: 1..7,
                 value: { abierto, capacidad? } | null }]   null = quitar
  }

Responde la configuración y el horario propio que quedaron guardados.
Cada parte queda auditada igual que en sus endpoints por separado
(/sites/:id y /sites/:id/horario/:dia), que se mantienen para scripts.

*/
export const POST = async (
  req: AuthenticatedMedusaRequest<AdminSavePickupSiteAgendaType>,
  res: MedusaResponse
) => {
  const site = await requireSite(req, req.params.id);

  const saved = await pickupService(req).saveSiteAgenda(
    { stock_location_id: site.id, ...req.validatedBody },
    await actorOf(req)
  );

  res.json({
    config: saved.config
      ? {
          capacidad_diaria: saved.config.capacidad_diaria ?? null,
          lead_time_dias: saved.config.lead_time_dias ?? null,
          horizonte_dias: saved.config.horizonte_dias ?? null,
        }
      : null,
    horario: saved.horario.map((h) => ({
      dia_semana: h.dia_semana,
      abierto: h.abierto,
      capacidad: h.capacidad ?? null,
    })),
  });
};
