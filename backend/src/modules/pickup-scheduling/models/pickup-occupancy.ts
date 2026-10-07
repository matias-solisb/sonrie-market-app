import { model } from "@medusajs/framework/utils";

/*

Contador de ocupación por (site, fecha, bloque) (Documento técnico §7). Es
lo que impide sobrevender cupos: se incrementa con un UPDATE condicional
(`ocupados < capacidad`) dentro de la transacción del checkout. Solo lo
modifica el service; nunca escribirlo a mano.

La capacidad NO se guarda acá: se calcula con las reglas (`resolveDays`),
así un cambio de capacidad desde el Admin aplica de inmediato.

`bloque` es null en el MVP (cupo por día). En F2 guarda el bloque horario
("09:00"). El índice único es parcial para el caso null.

*/
export const PickupOccupancy = model
  .define("pickup_occupancy", {
    id: model.id({ prefix: "pkocc" }).primaryKey(),
    stock_location_id: model.text(),
    fecha: model.text(),
    bloque: model.text().nullable(),
    ocupados: model.number().default(0),
  })
  .indexes([
    {
      on: ["stock_location_id", "fecha"],
      unique: true,
      where: "bloque IS NULL AND deleted_at IS NULL",
    },
    {
      on: ["stock_location_id", "fecha", "bloque"],
      unique: true,
      where: "bloque IS NOT NULL AND deleted_at IS NULL",
    },
  ]);
