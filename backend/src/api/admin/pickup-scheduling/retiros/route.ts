import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { addDays, toFecha } from "../../../../modules/pickup-scheduling/utils/fecha";
import { parseQuery, pickupService, siteNames } from "../utils";
import { AdminPickupRetirosQuery } from "../validators";
import { buscarPedidos, paginacion, POR_PAGINA, toRetiros } from "./helpers";

/*

GET /admin/pickup-scheduling/retiros
    ?stock_location_id=&fecha=YYYY-MM-DD   pantalla "Retiros del día"
    &q=texto                                 búsqueda (cualquier día)
    &pagina=N                                página de "No retirados" o de la búsqueda
GET /admin/pickup-scheduling/retiros?order_id=   widget del pedido

  {
    hoy, fecha, busqueda,
    retiros:      [Retiro]  // del día (o la página de resultados de la búsqueda)
    no_retirados: [Retiro]  // una página de agendados de días anteriores sin entregar
    paginacion: { pagina, por_pagina, total, paginas } | null
                 // de "No retirados" (o de la búsqueda, si hay `q`)
    resumen: { por_entregar, entregados, no_retirados, anulados }
  }

Cada Retiro trae el estado guardado (`estado`) y el que se muestra
(`estado_retiro`: agendado, retira_hoy, no_retirado, retirado, anulado),
más nombre, RUT y productos para confirmar la entrega (ver helpers.ts).

Rendimiento: "No retirados" y la búsqueda se paginan en la base de datos
(10 por página) y solo esa página se completa con pedido, cliente y
productos. La búsqueda encuentra primero los pedidos que calzan (por n.º o
por cliente, ver `buscarPedidos`) y después sus cupos. La lista del día no
se pagina: la acota la capacidad del site.

Los cupos `pendiente` (checkout en curso) no se listan. La búsqueda por
RUT, nombre o correo cubre desde 90 días atrás (el colaborador puede llegar
otro día que el agendado); por n.º de pedido, cualquier fecha.

*/
const DIAS_BUSQUEDA = 90;

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const q = parseQuery(AdminPickupRetirosQuery, req.query);
  const service = pickupService(req);
  const hoy = toFecha();
  const fecha = q.fecha ?? hoy;
  const pagina = q.pagina ?? 1;
  const pagin = { skip: (pagina - 1) * POR_PAGINA, take: POR_PAGINA };
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

    return res.json({
      hoy, fecha, busqueda: null, retiros, no_retirados: [], paginacion: null, resumen: null,
    });
  }

  if (q.q) {
    const orderIds = await buscarPedidos(req, q.q);
    const porNumero = q.q.trim().replace(/^#/, "");
    const soloNumero = /^\d+$/.test(porNumero) && q.q.trim().startsWith("#");

    const [bookings, total] = orderIds.length
      ? await service.listAndCountPickupBookings(
          {
            ...site,
            estado: visibles,
            order_id: orderIds,
            ...(soloNumero ? {} : { fecha: { $gte: addDays(hoy, -DIAS_BUSQUEDA) } }),
          } as any,
          { order: { fecha: "DESC", id: "DESC" }, ...pagin }
        )
      : [[], 0];
    const retiros = await toRetiros(req, bookings as any, names, hoy);

    return res.json({
      hoy,
      fecha,
      busqueda: q.q,
      retiros,
      no_retirados: [],
      paginacion: paginacion(pagina, total),
      resumen: null,
    });
  }

  const [delDia, [pendientes, totalPendientes]] = await Promise.all([
    service.listPickupBookings(
      { ...site, fecha, estado: visibles } as any,
      { order: { created_at: "ASC" } }
    ),
    service.listAndCountPickupBookings(
      { ...site, estado: "agendado", fecha: { $lt: hoy } } as any,
      { order: { fecha: "DESC", id: "DESC" }, ...pagin }
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
    paginacion: paginacion(pagina, totalPendientes),
    resumen: {
      por_entregar: contar(["agendado", "retira_hoy"]),
      entregados: contar(["retirado"]),
      no_retirados: totalPendientes,
      anulados: contar(["anulado"]),
    },
  });
};
