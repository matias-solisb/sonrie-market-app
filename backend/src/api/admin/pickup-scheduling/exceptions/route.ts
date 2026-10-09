import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { toFecha } from "../../../../modules/pickup-scheduling/utils/fecha";
import {
  actorOf,
  parseQuery,
  pickupService,
  requireSite,
  siteNames,
} from "../utils";
import {
  AdminCreatePickupExceptionType,
  AdminListPickupExceptionsQuery,
} from "../validators";

/*

GET  /admin/pickup-scheduling/exceptions?desde=&hasta=&stock_location_id=
     Feriados y excepciones del rango (por defecto, el año en curso), de
     todos los sites o de uno (más las globales). Ordenadas por fecha.
POST /admin/pickup-scheduling/exceptions
     Crea una excepción. Queda auditada.

*/
const serialize = (e: any, names: Map<string, string>) => ({
  id: e.id,
  fecha: e.fecha,
  stock_location_id: e.stock_location_id ?? null,
  site_name: e.stock_location_id ? names.get(e.stock_location_id) ?? null : null,
  tipo: e.tipo,
  irrenunciable: e.irrenunciable,
  capacidad: e.capacidad ?? null,
  motivo: e.motivo ?? null,
});

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const q = parseQuery(AdminListPickupExceptionsQuery, req.query);
  const anio = toFecha().slice(0, 4);
  const desde = q.desde ?? `${anio}-01-01`;
  const hasta = q.hasta ?? `${anio}-12-31`;

  const exceptions = await pickupService(req).listSiteScheduleExceptions(
    {
      fecha: { $gte: desde, $lte: hasta },
      ...(q.stock_location_id && {
        $or: [{ stock_location_id: q.stock_location_id }, { stock_location_id: null }],
      }),
    },
    { order: { fecha: "ASC" } }
  );
  const names = await siteNames(req);

  res.json({
    desde,
    hasta,
    exceptions: exceptions.map((e) => serialize(e, names)),
  });
};

export const POST = async (
  req: AuthenticatedMedusaRequest<AdminCreatePickupExceptionType>,
  res: MedusaResponse
) => {
  const body = req.validatedBody;

  if (body.stock_location_id) {
    await requireSite(req, body.stock_location_id);
  }

  const created = await pickupService(req).createException(body, actorOf(req));

  res.json({ exception: serialize(created, await siteNames(req)) });
};
