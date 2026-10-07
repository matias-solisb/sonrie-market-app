import { model } from "@medusajs/framework/utils";

/*

Excepción del calendario para una fecha (Documento técnico §7,
`SiteScheduleException`): feriados y días especiales.

- `stock_location_id` null = aplica a todos los sites (ej. feriados
  nacionales). Con valor = solo ese site, y gana sobre la global.
- `tipo`:
    feriado  → cerrado por feriado
    cerrado  → cerrado por otro motivo (inventario, mantención…)
    abierto  → abre aunque el horario o un feriado global digan lo contrario
               (feriado no irrenunciable que se trabaja, sábado especial)
- `irrenunciable`: solo en feriados globales. Ningún site puede abrir ese
  día (la excepción "abierto" se rechaza al crearla y se ignora al leer).
- `capacidad`: solo en excepciones "abierto" de un site; null = la
  capacidad que corresponda al día.
- `fecha`: "YYYY-MM-DD" (fecha de calendario de Chile, no un instante).

*/
export const SiteScheduleException = model
  .define("site_schedule_exception", {
    id: model.id({ prefix: "pkexc" }).primaryKey(),
    fecha: model.text(),
    stock_location_id: model.text().nullable(),
    tipo: model.enum(["feriado", "cerrado", "abierto"]),
    irrenunciable: model.boolean().default(false),
    capacidad: model.number().nullable(),
    motivo: model.text().nullable(),
  })
  .indexes([
    {
      on: ["fecha", "stock_location_id"],
      unique: true,
      where: "stock_location_id IS NOT NULL AND deleted_at IS NULL",
    },
    {
      on: ["fecha"],
      unique: true,
      where: "stock_location_id IS NULL AND deleted_at IS NULL",
    },
  ]);
