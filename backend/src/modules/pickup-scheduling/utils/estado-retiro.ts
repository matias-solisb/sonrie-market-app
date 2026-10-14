import { EstadoBooking, EstadoRetiro } from "../types";

/*

Estado del retiro que ve una persona, a partir del estado guardado del
cupo y de la fecha de hoy (en Santiago, "YYYY-MM-DD").

  agendado + fecha futura  → agendado
  agendado + fecha = hoy   → retira_hoy
  agendado + fecha pasada  → no_retirado
  el resto                 → igual al guardado

"No retirado" se calcula aquí y no se guarda: así no hace falta un job que
recorra los pedidos cada noche. La anulación automática por
`dias_para_anular` (F2) sí será un job, y pasará el cupo a `anulado`.

*/
export function estadoRetiro(
  booking: { estado: EstadoBooking; fecha: string },
  hoy: string
): EstadoRetiro {
  if (booking.estado !== "agendado") {
    return booking.estado;
  }

  // F1: un pedido `preparado` también puede quedar "no retirado" si pasa
  // su fecha; aplicar la misma comparación a ese estado.
  if (booking.fecha === hoy) {
    return "retira_hoy";
  }

  return booking.fecha < hoy ? "no_retirado" : "agendado";
}
