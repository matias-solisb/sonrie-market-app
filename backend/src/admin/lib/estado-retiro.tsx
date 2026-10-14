import {
  CheckCircleSolid,
  Clock,
  ExclamationCircleSolid,
  ShoppingBag,
  XCircle,
} from "@medusajs/icons";
import { ComponentType } from "react";

/*

Palabras, colores e íconos del estado del retiro en el Admin. Un solo
lugar: lo usan "Retiros del día" y el widget "Retiro" del pedido.

Reglas (pensadas para operadores de cualquier edad):
- Palabras de sala de venta: "Entregado", "No retirado". Nunca "cupo",
  "booking", "cumplimiento" ni "fulfillment".
- El estado nunca depende solo del color: siempre va ícono + texto.

El "Mis pedidos" del storefront tiene sus propias frases (es otro proyecto)
en storefront/src/lib/util/pickup-status.ts: si cambias una palabra acá,
cámbiala allá.

*/

export type EstadoRetiro =
  | "pendiente"
  | "agendado"
  | "retira_hoy"
  | "no_retirado"
  | "retirado"
  | "anulado";
// F1: | "preparado"

type Color = "blue" | "orange" | "red" | "green" | "grey";

export const ESTADO_RETIRO: Record<
  EstadoRetiro,
  { label: string; color: Color; Icon: ComponentType<{ className?: string }> }
> = {
  pendiente: { label: "Creándose", color: "grey", Icon: Clock },
  agendado: { label: "Agendado", color: "blue", Icon: Clock },
  retira_hoy: { label: "Retira hoy", color: "orange", Icon: ShoppingBag },
  // F1: preparado: { label: "Listo para retiro", color: "purple", Icon: ArchiveBox },
  no_retirado: { label: "No retirado", color: "red", Icon: ExclamationCircleSolid },
  retirado: { label: "Entregado", color: "green", Icon: CheckCircleSolid },
  anulado: { label: "Anulado", color: "grey", Icon: XCircle },
};

const COLOR_CLASSES: Record<Color, string> = {
  blue: "bg-ui-tag-blue-bg text-ui-tag-blue-text border-ui-tag-blue-border",
  orange: "bg-ui-tag-orange-bg text-ui-tag-orange-text border-ui-tag-orange-border",
  red: "bg-ui-tag-red-bg text-ui-tag-red-text border-ui-tag-red-border",
  green: "bg-ui-tag-green-bg text-ui-tag-green-text border-ui-tag-green-border",
  grey: "bg-ui-tag-neutral-bg text-ui-tag-neutral-text border-ui-tag-neutral-border",
};

/** Etiqueta de estado grande y legible: ícono + texto, nunca solo color. */
export const EstadoRetiroChip = ({
  estado,
  className = "",
}: {
  estado: EstadoRetiro;
  className?: string;
}) => {
  const { label, color, Icon } = ESTADO_RETIRO[estado];

  return (
    <span
      className={`inline-flex items-center gap-x-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-base font-medium ${COLOR_CLASSES[color]} ${className}`}
      data-testid={`estado-retiro-${estado}`}
    >
      <Icon className="shrink-0" />
      {label}
    </span>
  );
};

/** "2026-10-08" → "jueves 8 de octubre" (fecha de calendario, sin correrse por zona horaria). */
export const fechaLarga = (fecha: string, conAnio = false) => {
  const parts = new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(conAnio && { year: "numeric" as const }),
    timeZone: "UTC",
  }).formatToParts(new Date(`${fecha}T12:00:00Z`));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  return `${get("weekday")} ${get("day")} de ${get("month")}${
    conAnio ? ` de ${get("year")}` : ""
  }`;
};

/** Instante → "10:42" (hora de Chile). */
export const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-CL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Santiago",
  });

/** Instante → "8 de octubre a las 10:42" (hora de Chile). */
export const fechaHora = (iso: string) => {
  const d = new Date(iso);
  const dia = d.toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
    timeZone: "America/Santiago",
  });

  return `${dia} a las ${hora(iso)}`;
};

/** "agendado" con fecha → frase completa, para el widget y la confirmación. */
export const fraseEstado = (r: {
  estado_retiro: EstadoRetiro;
  fecha: string;
  site_name: string | null;
  retirado_at: string | null;
  retirado_por_email: string | null;
  retirado_fuera_de_pantalla: boolean;
}) => {
  const donde = r.site_name ? ` en ${r.site_name}` : "";

  switch (r.estado_retiro) {
    case "agendado":
      return `Retira el ${fechaLarga(r.fecha)}${donde}. Aún no se entrega.`;
    case "retira_hoy":
      return `Retira hoy${donde}. Aún no se entrega.`;
    case "no_retirado":
      return `Debía retirarse el ${fechaLarga(r.fecha)}${donde} y no se ha entregado.`;
    case "retirado": {
      const cuando = r.retirado_at ? ` el ${fechaHora(r.retirado_at)}` : "";
      const quien = r.retirado_por_email
        ? ` por ${r.retirado_por_email}`
        : r.retirado_fuera_de_pantalla
        ? " (desde el detalle del pedido)"
        : "";
      return `Entregado${cuando}${quien}.`;
    }
    case "anulado":
      return "Pedido anulado. El día quedó libre para otro pedido.";
    case "pendiente":
      return "El pedido se está creando. Actualiza en unos segundos.";
  }
};

/** ¿Se puede entregar en este estado? */
export const sePuedeEntregar = (estado: EstadoRetiro) =>
  estado === "agendado" || estado === "retira_hoy" || estado === "no_retirado";
// F1: || estado === "preparado"
