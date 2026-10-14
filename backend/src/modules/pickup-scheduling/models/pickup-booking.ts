import { model } from "@medusajs/framework/utils";

/*

Cupo de retiro de un pedido (Documento técnico §6–7, `PickupBooking`).

Estados guardados:

  pendiente ──► agendado ──► retirado
                    │
                    └──────► anulado

- `pendiente`: se crea en el checkout (hook de completeCartWorkflow) con
  `cart_id`. Dura un instante: lo que tarda en crearse el pedido.
- `agendado`: al crearse el pedido (subscriber `order.placed`) se completa
  `order_id`. Decisión del MVP: el cupo queda agendado apenas se crea el
  pedido, sin esperar validación SAP (el Documento técnico §6 lo confirma
  recién en "Validada SAP", Fase 4).
- `retirado`: el operador entregó el pedido ("Retiros del día" o widget
  del pedido → workflow `entregar-pedido`). Guarda cuándo y quién. El cupo
  sigue contando como ocupado ese día (es historia, no se devuelve).
- `anulado`: el pedido se anuló/rechazó. Devuelve el cupo para que otro
  colaborador lo tome. Un pedido `retirado` no se anula.

"No retirado" NO es un estado guardado: es un pedido `agendado` cuya fecha
ya pasó. Se calcula al leer (utils/estado-retiro.ts), así el MVP no
necesita un job nocturno.

F1 — paso "Listo para retiro": agregar `preparado` al enum (entre
`agendado` y `retirado`) con `preparado_at`/`preparado_por`, y una
migración que actualice el check de la columna. El workflow
`entregar-pedido` ya está separado en "crear cumplimiento" (= preparar) y
"marcar entregado", así que en F1 se parte en dos acciones.

F2: `bloque` (franja horaria; null en el MVP), historial de
reagendamientos y anulación automática por `dias_para_anular`.

*/
export const PickupBooking = model
  .define("pickup_booking", {
    id: model.id({ prefix: "pkbk" }).primaryKey(),
    cart_id: model.text(),
    order_id: model.text().nullable(),
    stock_location_id: model.text(),
    fecha: model.text(),
    bloque: model.text().nullable(),
    estado: model
      // F1: agregar "preparado" entre "agendado" y "retirado".
      .enum(["pendiente", "agendado", "retirado", "anulado"])
      .default("pendiente"),
    /** Cuándo se entregó (estado `retirado`). */
    retirado_at: model.dateTime().nullable(),
    /** Usuario del Admin que lo entregó (null: entregado fuera de la pantalla de retiros). */
    retirado_por: model.text().nullable(),
    /** Correo de ese usuario al momento de entregar (se conserva si el usuario se elimina). */
    retirado_por_email: model.text().nullable(),
    // F1: preparado_at / preparado_por (paso "Listo para retiro").
  })
  .indexes([
    {
      on: ["cart_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
    {
      on: ["order_id"],
      unique: true,
      where: "order_id IS NOT NULL AND deleted_at IS NULL",
    },
    {
      on: ["stock_location_id", "fecha"],
    },
  ]);
