import { model } from "@medusajs/framework/utils";

/*

Configuración de agenda de un site (Documento técnico §7, `SiteSlotConfig`).
Una fila por Stock Location. Cada campo null hereda el valor global de
`PickupSetting`.

- `capacidad_diaria`: capacidad por defecto del site (pedidos por día).
- `lead_time_dias` / `horizonte_dias`: overrides del site.

F2 suma acá la duración de bloque y `dias_para_anular`.

*/
export const SiteSlotConfig = model
  .define("site_slot_config", {
    id: model.id({ prefix: "pkcfg" }).primaryKey(),
    stock_location_id: model.text(),
    capacidad_diaria: model.number().nullable(),
    lead_time_dias: model.number().nullable(),
    horizonte_dias: model.number().nullable(),
  })
  .indexes([
    {
      on: ["stock_location_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ]);
