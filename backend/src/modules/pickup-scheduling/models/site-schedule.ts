import { model } from "@medusajs/framework/utils";

/*

Horario semanal de un site (Documento técnico §7, `SiteSchedule`). Una fila
por (site, día de la semana); los días sin fila usan
`PickupSetting.dias_abiertos_por_defecto`.

- `dia_semana`: ISO, lunes = 1 … domingo = 7.
- `capacidad`: capacidad de ese día de la semana (ej. sábado de medio día
  con menos cupos). Null = la capacidad por defecto del site.
- `hora_inicio` / `hora_fin` ("HH:mm"): para los bloques horarios de F2.
  En el MVP no se usan.

*/
export const SiteSchedule = model
  .define("site_schedule", {
    id: model.id({ prefix: "pksch" }).primaryKey(),
    stock_location_id: model.text(),
    dia_semana: model.number(),
    abierto: model.boolean().default(true),
    capacidad: model.number().nullable(),
    hora_inicio: model.text().nullable(),
    hora_fin: model.text().nullable(),
  })
  .indexes([
    {
      on: ["stock_location_id", "dia_semana"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ]);
