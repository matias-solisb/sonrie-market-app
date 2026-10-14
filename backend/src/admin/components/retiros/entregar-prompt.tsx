import { Alert, Button, Checkbox, Label, Prompt, Text, toast } from "@medusajs/ui";
import { useEffect, useState } from "react";
import { Retiro, useEntregarPedido } from "../../hooks/api/pickup-scheduling";
import { fechaLarga, fechaHora, hora } from "../../lib/estado-retiro";

/*

Confirmación antes de entregar un pedido. Es el único freno antes de una
acción que no se puede deshacer, así que muestra lo necesario para no
equivocarse de pedido:

- n.º de pedido grande,
- a quién se entrega (nombre y RUT; si no hay RUT, el correo),
- los productos con su cantidad, con casillas opcionales para revisar la
  bolsa (no bloquean el botón: son una ayuda, no un trámite),
- un aviso si el pedido es de otro día.

Lo usan "Retiros del día" y el widget "Retiro" del pedido.

*/
type Props = {
  retiro: Retiro | null;
  /** Fecha de hoy (YYYY-MM-DD, Santiago), para avisar si es de otro día. */
  hoy: string;
  onClose: () => void;
};

export const EntregarPrompt = ({ retiro, hoy, onClose }: Props) => {
  const entregar = useEntregarPedido();
  const [revisados, setRevisados] = useState<Set<number>>(new Set());

  useEffect(() => setRevisados(new Set()), [retiro?.booking_id]);

  if (!retiro) {
    return null;
  }

  const numero = retiro.display_id ? `#${retiro.display_id}` : "";
  const nombre = retiro.colaborador.nombre ?? retiro.colaborador.email ?? "el colaborador";

  const confirmar = async () => {
    if (!retiro.order_id) {
      return;
    }

    try {
      const res = await entregar.mutateAsync(retiro.order_id);
      const cuando = res.retiro.retirado_at ? hora(res.retiro.retirado_at) : "";

      if (res.entregado_ahora) {
        toast.success(`Pedido ${numero} entregado`, {
          description: `Entregado a ${nombre}${cuando ? ` a las ${cuando}` : ""}.`,
        });
      } else {
        toast.info(`El pedido ${numero} ya estaba entregado`, {
          description: res.retiro.retirado_at
            ? `Se entregó el ${fechaHora(res.retiro.retirado_at)}${
                res.retiro.retirado_por_email ? ` por ${res.retiro.retirado_por_email}` : ""
              }.`
            : undefined,
        });
      }
      onClose();
    } catch (e: any) {
      toast.error(`No se pudo entregar el pedido ${numero}`, {
        description: e?.message ?? "Intenta de nuevo.",
      });
    }
  };

  const otroDia =
    retiro.fecha < hoy
      ? `Este pedido debía retirarse el ${fechaLarga(retiro.fecha)}. Puedes entregarlo igual.`
      : retiro.fecha > hoy
      ? `Este pedido está agendado para el ${fechaLarga(retiro.fecha)}, no para hoy. Puedes entregarlo igual.`
      : null;

  const toggle = (i: number) =>
    setRevisados((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  return (
    <Prompt open variant="confirmation" onOpenChange={(open) => !open && onClose()}>
      <Prompt.Content className="max-w-lg" data-testid="entregar-prompt">
        <Prompt.Header>
          <Prompt.Title className="text-2xl">¿Entregar el pedido {numero}?</Prompt.Title>
          <Prompt.Description asChild>
            <div className="flex flex-col gap-y-1 pt-2 text-base text-ui-fg-base">
              <span>
                A: <strong className="text-lg">{nombre}</strong>
              </span>
              <span data-testid="entregar-rut">
                {retiro.colaborador.rut
                  ? `RUT ${retiro.colaborador.rut}`
                  : `RUT no registrado${retiro.colaborador.email ? ` · ${retiro.colaborador.email}` : ""}`}
              </span>
              <span className="text-ui-fg-subtle">Pídele su RUT y compáralo antes de entregar.</span>
            </div>
          </Prompt.Description>
        </Prompt.Header>

        <div className="flex flex-col gap-y-3 px-6 pb-2">
          {otroDia && <Alert variant="warning">{otroDia}</Alert>}

          <Text size="base" weight="plus">
            Productos ({retiro.total_unidades} {retiro.total_unidades === 1 ? "unidad" : "unidades"}) — revisa la bolsa:
          </Text>
          <ul className="flex flex-col gap-y-2">
            {retiro.productos.map((p, i) => (
              <li key={i} className="flex items-center gap-x-3">
                <Checkbox
                  id={`producto-${i}`}
                  checked={revisados.has(i)}
                  onCheckedChange={() => toggle(i)}
                  className="h-5 w-5"
                />
                <Label htmlFor={`producto-${i}`} className="cursor-pointer text-base">
                  <strong>{p.cantidad} ×</strong> {p.titulo}
                  {p.variante ? ` (${p.variante})` : ""}
                </Label>
              </li>
            ))}
          </ul>

          <Text size="base" className="text-ui-fg-subtle">
            Una vez entregado no se puede deshacer.
          </Text>
        </div>

        <Prompt.Footer>
          <Prompt.Cancel disabled={entregar.isPending} className="h-10 px-5 text-base">
            Volver
          </Prompt.Cancel>
          <Button
            size="large"
            className="text-base"
            onClick={confirmar}
            isLoading={entregar.isPending}
            data-testid="entregar-confirmar"
          >
            Sí, entregar
          </Button>
        </Prompt.Footer>
      </Prompt.Content>
    </Prompt>
  );
};
