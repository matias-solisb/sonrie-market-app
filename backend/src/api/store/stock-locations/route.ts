import type { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { listPickupSites } from "../../../utils/pickup-sites";

// Endpoint público (Store API) para el selector "Seleccione las opciones de
// entrega" del carrito: devuelve los sites de retiro con su dirección.
//
// Solo lista Stock Locations configurados como site (opción de retiro +
// sales channel propio, ver src/utils/pickup-sites.ts). Una bodega que no
// esté configurada no aparece: correr `setup-pickup-sites.ts`.
//
// No expone ids internos (sales channel, opción de envío): el cambio de
// site lo hace POST /store/carts/:id/pickup-site.
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const sites = await listPickupSites(query);

  res.json({
    stock_locations: sites.map((site) => ({
      id: site.id,
      name: site.name,
      address: site.address,
    })),
  });
};
