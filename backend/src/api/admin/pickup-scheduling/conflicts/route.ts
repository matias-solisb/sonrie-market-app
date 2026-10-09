import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { ordersById, pickupService, siteNames } from "../utils";

/*

GET /admin/pickup-scheduling/conflicts

Pedidos agendados desde hoy en un día que hoy está cerrado (se cerró el
día, se cargó un feriado o cambió el horario después de que el colaborador
eligió la fecha). Cerrar un día no anula ni mueve pedidos: la página
"Agenda de retiro" los lista para que alguien avise al colaborador.

  { conflicts: [{ booking_id, order_id, cart_id, stock_location_id,
                  site_name, fecha, estado, origen, motivo,
                  order: { id, display_id, email, status } | null }] }

*/
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const conflicts = await pickupService(req).listBookingConflicts();

  const [names, orders] = await Promise.all([
    siteNames(req),
    ordersById(
      req,
      conflicts.map((c) => c.order_id).filter(Boolean) as string[]
    ),
  ]);

  res.json({
    conflicts: conflicts.map((c) => ({
      ...c,
      site_name: names.get(c.stock_location_id) ?? null,
      order: c.order_id ? orders.get(c.order_id) ?? null : null,
    })),
  });
};
