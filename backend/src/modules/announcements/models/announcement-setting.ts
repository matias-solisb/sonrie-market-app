import { model } from "@medusajs/framework/utils";
import {
  ANNOUNCEMENT_SETTING_KEY,
  DEFAULT_COLOR_FONDO,
  DEFAULT_COLOR_TEXTO,
  DEFAULT_INTERVALO_SEGUNDOS,
} from "../constants";

/*

Configuración general de la barra de anuncios: una sola fila
(`clave` = "global"), mismo patrón que PickupSetting. La crea
`getSettings()` del service la primera vez que se pide.

- `intervalo_segundos`: cada cuánto rota la barra si hay varios anuncios.
- `lugares`: zonas del storefront donde se muestra (ANNOUNCEMENT_PLACES).
- `color_*`: hex #RRGGBB. `color_borde` null = sin borde.

*/
export const AnnouncementSetting = model
  .define("announcement_setting", {
    id: model.id({ prefix: "ancset" }).primaryKey(),
    clave: model.text().default(ANNOUNCEMENT_SETTING_KEY),
    intervalo_segundos: model.number().default(DEFAULT_INTERVALO_SEGUNDOS),
    lugares: model.json(),
    color_fondo: model.text().default(DEFAULT_COLOR_FONDO),
    color_texto: model.text().default(DEFAULT_COLOR_TEXTO),
    color_borde: model.text().nullable(),
  })
  .indexes([
    {
      on: ["clave"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ]);
