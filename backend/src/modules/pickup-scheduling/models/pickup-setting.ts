import { model } from "@medusajs/framework/utils";

/*

Configuración global de la agenda de retiro (una sola fila, `clave` =
"global"). Es el último nivel de la resolución de un día (ver service.ts,
`resolveDays`): lo que un site no define, lo toma de acá.

- `capacidad_por_defecto`: pedidos por día y site. Null = agenda sin
  configurar: no se muestran fechas y el checkout se bloquea, en vez de
  inventar un número.
- `lead_time_dias`: anticipación mínima. 1 = desde mañana.
- `horizonte_dias`: hasta cuántos días desde hoy se puede elegir.
- `dias_abiertos_por_defecto`: días ISO (lunes = 1 … domingo = 7) en que
  abren los sites que no tienen horario semanal propio.

Documento técnico §7 (`SiteSlotConfig`) y §15.3: lead-time y horizonte
eran definición abierta de F2; se adelantan al MVP con estos valores por
defecto, editables desde el Admin.

*/
export const PICKUP_SETTING_KEY = "global";
export const DEFAULT_LEAD_TIME_DIAS = 1;
export const DEFAULT_HORIZONTE_DIAS = 14;
export const DEFAULT_DIAS_ABIERTOS = [1, 2, 3, 4, 5];

export const PickupSetting = model
  .define("pickup_setting", {
    id: model.id({ prefix: "pkset" }).primaryKey(),
    clave: model.text().default(PICKUP_SETTING_KEY),
    capacidad_por_defecto: model.number().nullable(),
    lead_time_dias: model.number().default(DEFAULT_LEAD_TIME_DIAS),
    horizonte_dias: model.number().default(DEFAULT_HORIZONTE_DIAS),
    dias_abiertos_por_defecto: model.json(),
  })
  .indexes([
    {
      on: ["clave"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ]);
