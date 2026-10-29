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
} from "@medusajs/icons"
import { AnnouncementIcon } from "@/lib/util/announcement-place"

// Mismo mapeo clave → ícono que el Admin
// (backend/src/admin/components/announcements/announcement-icons.tsx).
export const ANNOUNCEMENT_ICONS: Record<AnnouncementIcon, typeof TruckFast> = {
  camion: TruckFast,
  calendario: Calendar,
  reloj: Clock,
  info: InformationCircle,
  alerta: ExclamationCircle,
  regalo: Gift,
  oferta: ReceiptPercent,
  tienda: BuildingStorefront,
  ubicacion: MapPin,
  campana: BellAlert,
  destacado: Sparkles,
}
