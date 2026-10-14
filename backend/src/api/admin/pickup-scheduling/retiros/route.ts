import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { addDays, toFecha } from "../../../../modules/pickup-scheduling/utils/fecha";
import { parseQuery, pickupService, siteNames } from "../utils";
import { AdminPickupRetirosQuery } from "../validators";
import { calzaBusqueda, toRetiros } from "./helpers";

/*

GET /admin/pickup-scheduling/retiros
    ?stock_location_id=&fecha=YYYY-MM-DD   pantalla "Retiros del día"
    &q=texto                                 búsqueda (cualquier día)
GET /admin/pickup-scheduling/retiros?order_id=   widget del pedido

  {
    hoy, fecha, busqueda,
    retiros:      [Retiro]  // del día (o resultados de la búsqueda)
    no_retirados: [Retiro]  // agendados de días anteriores sin entregar
    resumen: { por_entregar, entregados, no_retirados, anulados }
  }

Cada Retiro trae el estado guardado (`estado`) y el que se muestra
(`estado_retiro`: agendado, retira_hoy, no_retirado, retirado, anulado),
más nombre, RUT y productos para confirmar la entrega (ver helpers.ts).

Los cupos `pendiente` (checkout en curso) no se listan. La búsqueda cubre
desde 90 días atrás: el colaborador puede llegar otro día que el agendado.

*/
const DIAS_BUSQUEDA = 90;

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const q = parseQuery(AdminPickupRetirosQuery, req.query);
  const service = pickupService(req);
  const hoy = toFecha();
  const fecha = q.fecha ?? hoy;
  const site = q.stock_location_id
    ? { stock_location_id: q.stock_location_id }
    : {};
  const visibles = ["agendado", "retirado", "anulado"];
  // F1: agregar "preparado" a `visibles`.

  const names = await siteNames(req);

  if (q.order_id) {
    const bookings = await service.listPickupBookings(
      { order_id: q.order_id },
      { order: { created_at: "DESC" }, take: 1 }
    );
    const retiros = await toRetiros(req, bookings as any, names, hoy);

    return res.json({ hoy, fecha, busqueda: null, retiros, no_retirados: [], resumen: null });
  }

  if (q.q) {
    const bookings = await service.listPickupBookings(
      {
        ...site,
        estado: visibles,
        fecha: { $gte: addDays(hoy, -DIAS_BUSQUEDA) },
      } as any,
      { order: { fecha: "DESC" } }
    );
    const retiros = (await toRetiros(req, bookings as any, names, hoy)).filter((r) =>
      calzaBusqueda(r, q.q!)
    );

    return res.json({ hoy, fecha, busqueda: q.q, retiros, no_retirados: [], resumen: null });
  }

  const [delDia, pendientes] = await Promise.all([
    service.listPickupBookings(
      { ...site, fecha, estado: visibles } as any,
      { order: { created_at: "ASC" } }
    ),
    service.listPickupBookings(
      { ...site, estado: "agendado", fecha: { $lt: hoy } } as any,
      { order: { fecha: "DESC" } }
    ),
  ]);

  const [retiros, no_retirados] = await Promise.all([
    toRetiros(req, delDia as any, names, hoy),
    toRetiros(req, pendientes as any, names, hoy),
  ]);

  const contar = (estados: string[]) =>
    retiros.filter((r) => estados.includes(r.estado_retiro)).length;

  res.json({
    hoy,
    fecha,
    busqueda: null,
    retiros,
    no_retirados,
    resumen: {
      por_entregar: contar(["agendado", "retira_hoy"]),
      entregados: contar(["retirado"]),
      no_retirados: no_retirados.length,
      anulados: contar(["anulado"]),
    },
  });
};
