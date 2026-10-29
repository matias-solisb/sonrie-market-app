import { model } from "@medusajs/framework/utils";
import {
  ANNOUNCEMENT_ICON_POSITIONS,
  ANNOUNCEMENT_ICONS,
} from "../constants";

/*

Anuncio de la barra superior del storefront (sobre el header).

- `nombre`: título interno, solo se ve en el Admin.
- `texto`: lo que lee el colaborador en la barra.
- `link`: opcional; si existe, toda la barra es clickeable. Solo se
  aceptan https?:// o rutas relativas "/..." (validators.ts).
- `icono` / `posicion_icono`: clave de ANNOUNCEMENT_ICONS, a la
  izquierda o derecha del texto.
- `fecha_inicio` / `fecha_fin`: vigencia (UTC). Null = abierto por ese
  lado. Fuera de la vigencia no se muestra aunque esté `activo`
  (utils/vigencia.ts).
- `activo`: apagarlo sin borrarlo.

Los colores, el intervalo de rotación y los lugares donde se muestra son
globales (AnnouncementSetting), igual que en la plataforma legacy.

*/
export const Announcement = model.define("announcement", {
  id: model.id({ prefix: "anc" }).primaryKey(),
  nombre: model.text(),
  texto: model.text(),
  link: model.text().nullable(),
  icono: model.enum([...ANNOUNCEMENT_ICONS]).nullable(),
  posicion_icono: model
    .enum([...ANNOUNCEMENT_ICON_POSITIONS])
    .default("izquierda"),
  fecha_inicio: model.dateTime().nullable(),
  fecha_fin: model.dateTime().nullable(),
  activo: model.boolean().default(true),
});
