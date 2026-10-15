import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types";
import { Button, Container, Heading, Text } from "@medusajs/ui";
import { useState } from "react";
import { EntregarPrompt } from "../components/retiros/entregar-prompt";
import { usePickupOrderRetiro } from "../hooks/api/pickup-scheduling";
import {
  EstadoRetiroChip,
  fechaLarga,
  fraseEstado,
  sePuedeEntregar,
} from "../lib/estado-retiro";

/*

Widget "Retiro" en el detalle del pedido (Admin → Pedidos → detalle,
columna lateral).

Dice en una frase dónde y cuándo retira el colaborador y en qué va:
  🕒 Agendado     "Retira el jueves 16 de octubre en Planta Renca. Aún no se entrega."
  📦 Retira hoy   "Retira hoy en Planta Renca. Aún no se entrega."
  ⚠ No retirado  "Debía retirarse el 8 de octubre … y no se ha entregado."
  ✓ Entregado    "Entregado el 8 de octubre a las 10:42 por ana@…"
  ✕ Anulado      "Pedido anulado. El día quedó libre para otro pedido."

Mientras no se entrega, ofrece "Marcar como entregado" (misma confirmación
que "Retiros del día"). Ese botón reemplaza a los nativos de Medusa
("Cumplir artículos" + "Marcar como recogido"); si alguien igual usa los
nativos, el cupo queda entregado de todas formas.

Si el pedido no tiene fecha de retiro (p. ej. creado a mano desde el
Admin, sin pasar por el checkout), lo dice.

Datos: GET /admin/pickup-scheduling/retiros?order_id=

*/
const OrderPickupDateWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const { data, isPending, isError } = usePickupOrderRetiro(order.id, order.status);
  const [confirmando, setConfirmando] = useState(false);
  const retiro = data?.retiros[0];
  // Recién anulado en Medusa: el cupo se libera un instante después.
  // Mientras tanto no se ofrece entregar.
  const anulado = order.status === "canceled";

  return (
    <Container className="divide-y p-0" data-testid="order-pickup-date">
      <div className="flex items-center justify-between gap-x-2 px-6 py-4">
        <Heading level="h2">Retiro</Heading>
        {retiro && <EstadoRetiroChip estado={retiro.estado_retiro} />}
      </div>

      <div className="flex flex-col gap-y-3 px-6 py-4">
        {isPending ? (
          <Text>Cargando...</Text>
        ) : isError ? (
          <Text className="text-ui-fg-error">
            No se pudo cargar la fecha de retiro. Recarga la página.
          </Text>
        ) : !retiro ? (
          <Text className="text-ui-fg-subtle">
            Este pedido no tiene fecha de retiro agendada.
          </Text>
        ) : (
          <>
            <Text size="base" data-testid="order-pickup-frase">
              {fraseEstado(retiro)}
            </Text>

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-ui-fg-subtle">Site</dt>
              <dd data-testid="order-pickup-site">
                {retiro.site_name ?? retiro.stock_location_id}
              </dd>
              <dt className="text-ui-fg-subtle">Fecha</dt>
              <dd
                className={retiro.estado === "anulado" ? "line-through" : undefined}
                data-testid="order-pickup-fecha"
              >
                {fechaLarga(retiro.fecha, true)}
              </dd>
            </dl>

            {!anulado && sePuedeEntregar(retiro.estado_retiro) && (
              <>
                <Button
                  size="large"
                  className="w-full text-base"
                  onClick={() => setConfirmando(true)}
                  data-testid="order-pickup-entregar"
                >
                  Marcar como entregado
                </Button>
                <Text size="small" className="text-ui-fg-subtle">
                  Usa este botón para entregar; no hace falta "Cumplir
                  artículos".
                </Text>
              </>
            )}
          </>
        )}
      </div>

      {data && (
        <EntregarPrompt
          retiro={confirmando ? retiro ?? null : null}
          hoy={data.hoy}
          onClose={() => setConfirmando(false)}
        />
      )}
    </Container>
  );
};

export const config = defineWidgetConfig({
  zone: "order.details.side.before",
});

export default OrderPickupDateWidget;
