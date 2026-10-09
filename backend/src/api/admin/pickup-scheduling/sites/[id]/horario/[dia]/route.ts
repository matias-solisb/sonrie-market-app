import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { MedusaError } from "@medusajs/framework/utils";
import { actorOf, pickupService, requireSite } from "../../../../utils";
import { AdminUpsertPickupScheduleType } from "../../../../validators";

/*

POST   /admin/pickup-scheduling/sites/:id/horario/:dia
       { abierto, capacidad? } — horario propio de ese día de la semana
       (1 = lunes … 7 = domingo). Sin `capacidad` se conserva la guardada.
DELETE /admin/pickup-scheduling/sites/:id/horario/:dia
       Quita el horario propio: el día vuelve a los valores generales.

Ambos quedan auditados.

*/
const parseDia = (value: string) => {
  const dia = Number(value);

  if (!Number.isInteger(dia) || dia < 1 || dia > 7) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `Día de la semana inválido: ${value}. Use 1 (lunes) a 7 (domingo).`
    );
  }

  return dia;
};

export const POST = async (
  req: AuthenticatedMedusaRequest<AdminUpsertPickupScheduleType>,
  res: MedusaResponse
) => {
  const site = await requireSite(req, req.params.id);
  const dia = parseDia(req.params.dia);

  const horario = await pickupService(req).upsertSiteSchedule(
    { stock_location_id: site.id, dia_semana: dia, ...req.validatedBody },
    await actorOf(req)
  );

  res.json({
    horario: {
      dia_semana: horario.dia_semana,
      abierto: horario.abierto,
      capacidad: horario.capacidad ?? null,
    },
  });
};

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const site = await requireSite(req, req.params.id);
  const dia = parseDia(req.params.dia);

  await pickupService(req).deleteSiteSchedule(site.id, dia, await actorOf(req));

  res.json({ dia_semana: dia, deleted: true });
};
