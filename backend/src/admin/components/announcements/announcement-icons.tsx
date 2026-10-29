import {
  BellAlert,
  BuildingStorefront,
  Calendar,
  Clock,
  ExclamationCircle,
  Gift,
  InformationCircle,
  MapPin,
  ReceiptPercent,
  Sparkles,
  TruckFast,
} from "@medusajs/icons";
import type { ComponentType, SVGProps } from "react";
import type {
  AnnouncementIcon,
  AnnouncementPlace,
} from "../../../modules/announcements/constants";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

// Mismo mapeo clave → ícono que el storefront
// (storefront/src/modules/layout/components/announcement-bar/icons.tsx).
export const ANNOUNCEMENT_ICON_OPTIONS: {
  value: AnnouncementIcon;
  label: string;
  Icon: IconComponent;
}[] = [
  { value: "camion", label: "Camión / entrega", Icon: TruckFast },
  { value: "calendario", label: "Calendario", Icon: Calendar },
  { value: "reloj", label: "Reloj", Icon: Clock },
  { value: "info", label: "Información", Icon: InformationCircle },
  { value: "alerta", label: "Alerta", Icon: ExclamationCircle },
  { value: "regalo", label: "Regalo", Icon: Gift },
  { value: "oferta", label: "Oferta", Icon: ReceiptPercent },
  { value: "tienda", label: "Tienda", Icon: BuildingStorefront },
  { value: "ubicacion", label: "Ubicación / site", Icon: MapPin },
  { value: "campana", label: "Campana", Icon: BellAlert },
  { value: "destacado", label: "Destacado", Icon: Sparkles },
];

export const iconFor = (value: AnnouncementIcon | null | undefined) =>
  ANNOUNCEMENT_ICON_OPTIONS.find((option) => option.value === value);

export const ANNOUNCEMENT_PLACE_LABELS: Record<AnnouncementPlace, string> = {
  home: "Inicio",
  catalogo: "Catálogo y categorías",
  producto: "Detalle de producto",
  carrito: "Carrito",
  checkout: "Checkout",
  cuenta: "Mi cuenta",
  login: "Inicio de sesión (sin sesión)",
};
