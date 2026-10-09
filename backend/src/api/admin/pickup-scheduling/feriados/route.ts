import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { ANIOS_CON_FERIADOS } from "../../../../modules/pickup-scheduling/data/feriados-chile";
import { actorOf, pickupService } from "../utils";
import { AdminLoadHolidaysType } from "../validators";

/*

GET  /admin/pickup-scheduling/feriados — años con feriados disponibles.
POST /admin/pickup-scheduling/feriados { anio } — carga los feriados
     nacionales de Chile de ese año como excepciones globales (los
     irrenunciables quedan marcados). Idempotente: no toca las fechas que ya
     tienen una excepción global. Queda auditado.

  { anio, creados: ["YYYY-MM-DD"...], omitidos: [...] }

Lista y fuentes: src/modules/pickup-scheduling/data/feriados-chile.ts.

*/
export const GET = async (_req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  res.json({ anios: ANIOS_CON_FERIADOS });
};

export const POST = async (
  req: AuthenticatedMedusaRequest<AdminLoadHolidaysType>,
  res: MedusaResponse
) => {
  const result = await pickupService(req).loadHolidays(
    req.validatedBody.anio,
    actorOf(req)
  );

  res.json(result);
};
