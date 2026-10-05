import { MedusaContainer } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";
import { createStockLocationsWorkflow } from "@medusajs/medusa/core-flows";
import { ensurePickupSite } from "../../src/utils/pickup-sites";

/**
 * Shipping profile "default" (lo exige la opción de retiro y los productos).
 */
export const ensureDefaultShippingProfile = async (container: MedusaContainer) => {
  const fulfillment = container.resolve(Modules.FULFILLMENT);
  const [existing] = await fulfillment.listShippingProfiles({ type: "default" });

  return (
    existing ??
    (await fulfillment.createShippingProfiles({ name: "Default", type: "default" }))
  );
};

/**
 * Crea un stock location en Chile y lo configura como site de retiro.
 */
export const createPickupSite = async (
  container: MedusaContainer,
  { name, catalogSalesChannelId }: { name: string; catalogSalesChannelId: string }
) => {
  const profile = await ensureDefaultShippingProfile(container);

  const {
    result: [location],
  } = await createStockLocationsWorkflow(container).run({
    input: {
      locations: [
        {
          name,
          address: {
            address_1: `Dirección de prueba ${name}`,
            city: "Santiago",
            country_code: "CL",
          },
        },
      ],
    },
  });

  return await ensurePickupSite(container, {
    stock_location_id: location.id,
    catalog_sales_channel_id: catalogSalesChannelId,
    shipping_profile_id: profile.id,
  });
};
