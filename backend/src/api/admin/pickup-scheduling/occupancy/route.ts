import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { addDays, toFecha } from "../../../../modules/pickup-scheduling/utils/fecha";
import { parseQuery, pickupService, requireSite } from "../utils";
import { AdminPickupOccupancyQuery } from "../validators";

/*

GET /admin/pickup-scheduling/occupancy?stock_location_id=&desde=&hasta=

Cada día del rango (por defecto, hoy y los 13 siguientes) con si abre, de
dónde sale esa decisión, capacidad, cupos tomados y libres. Máximo 93 días.

  { stock_location_id, desde, hasta,
    dias: [{ fecha, abierto, capacidad, ocupados, disponibles, origen, motivo }] }

*/
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const q = parseQuery(AdminPickupOccupancyQuery, req.query);
  const site = await requireSite(req, q.stock_location_id);

  const desde = q.desde ?? toFecha();
  const hasta = q.hasta ?? addDays(desde, 13);

  const dias = await pickupService(req).listDays(site.id, desde, hasta);

  res.json({
    stock_location_id: site.id,
    desde,
    hasta,
    dias: dias.map((d) => ({
      fecha: d.fecha,
      abierto: d.abierto,
      capacidad: d.capacidad,
      ocupados: d.ocupados,
      disponibles: d.disponibles,
      origen: d.origen,
      motivo: d.motivo,
    })),
  });
};
