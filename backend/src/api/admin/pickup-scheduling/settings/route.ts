import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { actorOf, pickupService } from "../utils";
import { AdminUpdatePickupSettingsType } from "../validators";

/*

GET  /admin/pickup-scheduling/settings — configuración general de la agenda.
POST /admin/pickup-scheduling/settings — edita capacidad por defecto,
     lead-time, horizonte y días abiertos. Queda auditado.

  { settings: { capacidad_por_defecto, lead_time_dias, horizonte_dias,
                dias_abiertos_por_defecto } }

*/
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const settings = await pickupService(req).getSettings();

  res.json({ settings });
};

export const POST = async (
  req: AuthenticatedMedusaRequest<AdminUpdatePickupSettingsType>,
  res: MedusaResponse
) => {
  const settings = await pickupService(req).updateSettings(
    req.validatedBody,
    actorOf(req)
  );

  res.json({ settings });
};
