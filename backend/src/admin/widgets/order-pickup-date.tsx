import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types";
import { Badge, Container, Heading, Text } from "@medusajs/ui";
import {
  PickupBookingEstado,
  usePickupOrderBooking,
} from "../hooks/api/pickup-scheduling";

/*

Widget "Retiro" en el detalle del pedido (Admin → Pedidos → detalle,
columna lateral). Muestra el site y la fecha de retiro que eligió el
colaborador, y el estado del cupo:

- Confirmado: el pedido tiene su cupo ese día.
- Liberado: el pedido se anuló y el cupo volvió a quedar disponible.
- Reservado: el pedido se está creando (dura un instante).

Si el pedido no tiene cupo (p. ej. un pedido creado a mano desde el Admin,
sin pasar por el checkout), lo dice.

Datos: GET /admin/pickup-scheduling/bookings?order_id=

*/

const ESTADO: Record<
  PickupBookingEstado,
  { label: string; color: "green" | "grey" | "orange" }
> = {
  confirmado: { label: "Confirmado", color: "green" },
  reservado: { label: "Reservado", color: "orange" },
  liberado: { label: "Liberado (pedido anulado)", color: "grey" },
};

/** "2026-10-08" → "jueves 8 de octubre de 2026" (fecha de calendario). */
const fechaLarga = (fecha: string) =>
  new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
    .format(new Date(`${fecha}T12:00:00Z`))
    .replace(",", "");

const OrderPickupDateWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const { data, isPending, isError } = usePickupOrderBooking(order.id);
  // Un pedido tiene un solo cupo; si hubiera más de uno, el más reciente.
  const booking = data?.bookings[0];

  return (
    <Container className="divide-y p-0" data-testid="order-pickup-date">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Retiro</Heading>
        {booking && (
          <Badge size="2xsmall" color={ESTADO[booking.estado].color}>
            {ESTADO[booking.estado].label}
          </Badge>
        )}
      </div>

      <div className="flex flex-col gap-y-3 px-6 py-4">
        {isPending ? (
          <Text size="small">Cargando...</Text>
        ) : isError ? (
          <Text size="small" className="text-ui-fg-error">
            No se pudo cargar la fecha de retiro.
          </Text>
        ) : !booking ? (
          <Text size="small" className="text-ui-fg-subtle">
            Este pedido no tiene fecha de retiro agendada.
          </Text>
        ) : (
          <>
            <div className="grid grid-cols-2 items-start gap-x-2">
              <Text size="small" weight="plus" className="text-ui-fg-subtle">
                Site
              </Text>
              <Text size="small" data-testid="order-pickup-site">
                {booking.site_name ?? booking.stock_location_id}
              </Text>
            </div>
            <div className="grid grid-cols-2 items-start gap-x-2">
              <Text size="small" weight="plus" className="text-ui-fg-subtle">
                Fecha
              </Text>
              <Text
                size="small"
                className={booking.estado === "liberado" ? "line-through" : undefined}
                data-testid="order-pickup-fecha"
              >
                {fechaLarga(booking.fecha)}
              </Text>
            </div>
          </>
        )}
      </div>
    </Container>
  );
};

export const config = defineWidgetConfig({
  zone: "order.details.side.before",
});

export default OrderPickupDateWidget;
