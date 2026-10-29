import { Text } from "@medusajs/ui";
import type { AnnouncementIconPosition, AnnouncementIcon } from "../../../modules/announcements/constants";
import { iconFor } from "./announcement-icons";

type Props = {
  texto: string;
  icono?: AnnouncementIcon | null;
  posicion_icono?: AnnouncementIconPosition;
  color_fondo?: string;
  color_texto?: string;
  color_borde?: string | null;
};

// Vista previa de cómo se verá la barra en la tienda (sin rotación).
export const AnnouncementBarPreview = ({
  texto,
  icono,
  posicion_icono = "izquierda",
  color_fondo = "#E01441",
  color_texto = "#FFFFFF",
  color_borde,
}: Props) => {
  const Icon = iconFor(icono)?.Icon;
  const icon = Icon ? <Icon className="shrink-0" /> : null;

  return (
    <div
      className="flex items-center justify-center gap-3 rounded-md px-4 py-2 text-center"
      style={{
        backgroundColor: color_fondo,
        color: color_texto,
        borderBottom: color_borde ? `2px solid ${color_borde}` : undefined,
      }}
    >
      {posicion_icono === "izquierda" && icon}
      <Text size="small" style={{ color: color_texto }}>
        {texto || "Texto del anuncio"}
      </Text>
      {posicion_icono === "derecha" && icon}
    </div>
  );
};
