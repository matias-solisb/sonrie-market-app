import { model } from "@medusajs/framework/utils";

/*

Auditoría de la agenda de retiro (spec técnica §5: "cambios
administrativos" con trazabilidad). Una fila por cambio real hecho desde el
Admin o un script.

- `actor_id`: usuario del Admin (user_...). Null si no vino de una sesión
  de Admin (script, seed).
- `entidad`: qué se cambió: configuracion | site | horario | excepcion.
- `accion`: crear | editar | eliminar.
- `stock_location_id`: site afectado (null = configuración o excepción
  global).
- `referencia`: dato para ubicar el cambio sin abrir `cambios`: la fecha
  de la excepción ("YYYY-MM-DD") o el día de la semana del horario ("1".."7").
- `cambios`: solo los campos que cambiaron, con su valor anterior y nuevo:
    { "capacidad_diaria": { "anterior": 20, "nuevo": 15 } }

Además de esta tabla, cada cambio se escribe en el log (Log Analytics).

*/
export const PickupScheduleChange = model
  .define("pickup_schedule_change", {
    id: model.id({ prefix: "pkchg" }).primaryKey(),
    actor_id: model.text().nullable(),
    entidad: model.enum(["configuracion", "site", "horario", "excepcion"]),
    accion: model.enum(["crear", "editar", "eliminar"]),
    stock_location_id: model.text().nullable(),
    referencia: model.text().nullable(),
    cambios: model.json(),
  })
  .indexes([
    {
      on: ["created_at"],
    },
  ]);
