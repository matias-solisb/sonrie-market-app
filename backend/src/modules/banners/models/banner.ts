import { model } from "@medusajs/framework/utils";

// Modelo del carrusel de banners del home. `orden` define la posición de
// despliegue (ascendente) y lo gestiona el panel de Admin por
// drag-and-drop, nunca escribiéndolo a mano. `activo` permite
// desactivar un banner sin borrarlo. `image_url` la resuelve el File
// Module (provider local por ahora, cloud más adelante) o, mientras
// tanto, se puede pegar manualmente.
export const Banner = model.define("banner", {
  id: model
    .id({
      prefix: "ban",
    })
    .primaryKey(),
  image_url: model.text(),
  orden: model.number().default(0),
  activo: model.boolean().default(true),
})
