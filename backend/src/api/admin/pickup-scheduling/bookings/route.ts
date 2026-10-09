import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { ordersById, parseQuery, pickupService, siteNames } from "../utils";
import { AdminPickupBookingsQuery } from "../validators";

/*

GET /admin/pickup-scheduling/bookings?order_id=
GET /admin/pickup-scheduling/bookings?fecha=YYYY-MM-DD[&stock_location_id=]

Cupos de retiro, para el Admin:
- `order_id`: el cupo de un pedido, en cualquier estado (el widget del
  detalle del pedido muestra site, fecha y si se liberó al anularlo).
- `fecha`: los pedidos agendados ese día (reservados o confirmados), de un
  site o de todos. Lo usa el aviso antes de cerrar un día.

  { bookings: [{ id, order_id, cart_id, stock_location_id, site_name, fecha,
                 estado, order: { id, display_id, email, status } | null }] }

*/
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const q = parseQuery(AdminPickupBookingsQuery, req.query);

  const filters: Record<string, unknown> = q.order_id
    ? { order_id: q.order_id }
    : {
        fecha: q.fecha,
        estado: ["reservado", "confirmado"],
        ...(q.stock_location_id && { stock_location_id: q.stock_location_id }),
      };

  const bookings = await pickupService(req).listPickupBookings(filters as any, {
    order: { created_at: "DESC" },
  });

  const [names, orders] = await Promise.all([
    siteNames(req),
    ordersById(
      req,
      bookings.map((b) => b.order_id).filter(Boolean) as string[]
    ),
  ]);

  res.json({
    bookings: bookings.map((b) => ({
      id: b.id,
      order_id: b.order_id,
      cart_id: b.cart_id,
      stock_location_id: b.stock_location_id,
      site_name: names.get(b.stock_location_id) ?? null,
      fecha: b.fecha,
      estado: b.estado,
      order: b.order_id ? orders.get(b.order_id) ?? null : null,
    })),
  });
};
