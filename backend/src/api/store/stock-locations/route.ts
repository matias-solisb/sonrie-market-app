import type { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

// Endpoint público (Store API) para el selector "Seleccione las opciones de
// entrega" del carrito: devuelve los Stock Locations (sites de retiro) con
// su dirección para que el storefront arme el <select>
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const { data: stock_locations } = await query.graph({
    entity: "stock_location",
    fields: [
      "id",
      "name",
      "address.address_1",
      "address.address_2",
      "address.city",
      "address.province",
      "address.postal_code",
      "address.country_code",
    ],
  });

  res.json({ stock_locations });
};
