import { MedusaContainer } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";
import { createStockLocationsWorkflow } from "@medusajs/medusa/core-flows";
import { ensurePickupSite } from "../../src/utils/pickup-sites";
import { PICKUP_SCHEDULING_MODULE } from "../../src/modules/pickup-scheduling";
import PickupSchedulingModuleService from "../../src/modules/pickup-scheduling/service";

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

/**
 * Agenda de retiro abierta todos los días con capacidad amplia, para que
 * los tests de checkout no dependan del día de la semana en que corren.
 * Los tests de pickup-scheduling ajustan capacidad y días por su cuenta.
 */
export const enablePickupScheduling = async (
  container: MedusaContainer,
  capacidad = 1000
) =>
  await container
    .resolve<PickupSchedulingModuleService>(PICKUP_SCHEDULING_MODULE)
    .updateSettings({
      capacidad_por_defecto: capacidad,
      dias_abiertos_por_defecto: [1, 2, 3, 4, 5, 6, 7],
    });

/** GET /store/pickup-slots del site, sin lanzar en 4xx/5xx. */
export const getPickupSlots = (api: any, stockLocationId: string, headers: any) =>
  api
    .get(`/store/pickup-slots?stock_location_id=${stockLocationId}`, headers)
    .catch((e: any) => e.response);

/** POST /store/carts/:id/pickup-date, sin lanzar en 4xx/5xx. */
export const setPickupDate = (api: any, cartId: string, fecha: string, headers: any) =>
  api
    .post(`/store/carts/${cartId}/pickup-date`, { fecha }, headers)
    .catch((e: any) => e.response);

/**
 * Elige para el carrito la primera fecha disponible del site, como haría
 * el colaborador en el storefront. Devuelve la fecha.
 */
export const setFirstPickupDate = async (
  api: any,
  cartId: string,
  stockLocationId: string,
  headers: any
): Promise<string> => {
  const slots = await getPickupSlots(api, stockLocationId, headers);
  const first = slots.data?.fechas?.find((f: any) => f.disponible);

  if (!first) {
    throw new Error(
      `setFirstPickupDate: sin fechas disponibles (${JSON.stringify(slots.data)})`
    );
  }

  const res = await setPickupDate(api, cartId, first.fecha, headers);

  if (res.status !== 200) {
    throw new Error(`setFirstPickupDate: ${res.status} ${JSON.stringify(res.data)}`);
  }

  return first.fecha;
};
