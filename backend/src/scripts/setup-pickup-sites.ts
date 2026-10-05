import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows";
import {
  ensurePickupSite,
  getCatalogSalesChannelId,
  listPickupSites,
} from "../utils/pickup-sites";

/*

Configura como sites de retiro los Stock Locations que ya existen en la
base (DEV/PRD). Idempotente: se puede correr cuantas veces se quiera, y
cada vez que se agregue una sala nueva en el Admin.

  # todos los stock locations
  npx medusa exec ./src/scripts/setup-pickup-sites.ts

  # solo algunos
  npx medusa exec ./src/scripts/setup-pickup-sites.ts sloc_01... sloc_02...

Por cada site crea lo que falte: opción "Retiro en {site}" ($0), sales
channel propio y enlaces (ver src/utils/pickup-sites.ts). Si el site ya
tenía una opción de retiro, le corrige las reglas (enabled_in_store /
is_return) para que la tienda la acepte.

Shipping profile: el checkout exige que cada producto tenga el MISMO
perfil que la opción de envío del carrito ("The cart items require
shipping profiles that are not satisfied..."). Por eso el script elige un
único "perfil de retiro" (el que ya usan las opciones de retiro existentes
o, si no hay, el perfil tipo "default"), lo usa para las opciones nuevas y
se lo asigna a los productos que no tienen perfil o tienen otro. Ojo: Medusa
crea solo un "Default Shipping Profile" al arrancar, así que puede haber
más de un perfil tipo "default" en la base.

Al final revisa
la configuración que el checkout necesita y avisa lo que falte; esos
avisos no se corrigen solos porque tocan datos de negocio:
- región con Chile (cl), CLP y el medio de pago `pp_system_default`;
- región de impuestos de Chile con proveedor;
- stock cargado en cada site (Admin → Inventario → Ubicaciones).

*/
export default async function setupPickupSites({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const catalogSalesChannelId = await getCatalogSalesChannelId(container);

  if (!catalogSalesChannelId) {
    logger.warn(
      "La tienda no tiene default sales channel: el catálogo no verá el stock de los sites."
    );
  }

  const { data: locations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
    filters: args?.length ? { id: args } : {},
  });

  if (!locations.length) {
    logger.warn("No hay stock locations que configurar.");
    return;
  }

  const pickupProfileId = await resolvePickupProfile(container, query, logger);

  if (!pickupProfileId) {
    logger.error('✘ No existe ningún shipping profile tipo "default". Créalo en el Admin y vuelve a correr el script.');
    return;
  }

  for (const location of locations) {
    try {
      const site = await ensurePickupSite(container, {
        stock_location_id: location.id,
        catalog_sales_channel_id: catalogSalesChannelId,
        shipping_profile_id: pickupProfileId,
      });
      logger.info(
        `✔ ${site.name} (${site.id}) → canal ${site.sales_channel_id}, opción ${site.shipping_option_id}`
      );
    } catch (e: any) {
      logger.error(`✘ ${location.name} (${location.id}): ${e.message}`);
    }
  }

  await assignPickupProfileToProducts(container, query, logger, pickupProfileId);

  await reportCheckoutConfig(query, logger, locations.map((l) => l.id));
}

/**
 * Perfil de las opciones de retiro: el que más usan las opciones de retiro
 * existentes; si no hay ninguna, el primer perfil tipo "default".
 */
async function resolvePickupProfile(
  container: ExecArgs["container"],
  query: any,
  logger: any
): Promise<string | undefined> {
  const fulfillment = container.resolve(Modules.FULFILLMENT);
  const sites = await listPickupSites(query);

  if (sites.length) {
    const options = await fulfillment.listShippingOptions({
      id: sites.map((site) => site.shipping_option_id),
    });
    const counts = new Map<string, number>();
    for (const option of options) {
      counts.set(option.shipping_profile_id, (counts.get(option.shipping_profile_id) ?? 0) + 1);
    }
    if (counts.size > 1) {
      logger.warn(
        `⚠ Las opciones de retiro usan ${counts.size} shipping profiles distintos: ${[...counts.keys()].join(", ")}. Se usará el más común.`
      );
    }
    const [mostCommon] = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (mostCommon) {
      return mostCommon[0];
    }
  }

  const [profile] = await fulfillment.listShippingProfiles({ type: "default" });
  return profile?.id;
}

/**
 * Deja todos los productos con el perfil de retiro.
 */
async function assignPickupProfileToProducts(
  container: ExecArgs["container"],
  query: any,
  logger: any,
  profileId: string
) {
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "shipping_profile.id"],
  });

  const toUpdate = products.filter((p: any) => p.shipping_profile?.id !== profileId);

  if (!toUpdate.length) {
    return;
  }

  const withoutProfile = toUpdate.filter((p: any) => !p.shipping_profile?.id).length;

  await updateProductsWorkflow(container).run({
    input: {
      selector: { id: toUpdate.map((p: any) => p.id) },
      update: { shipping_profile_id: profileId },
    },
  });

  logger.info(
    `✔ Perfil de retiro (${profileId}) asignado a ${toUpdate.length} producto(s): ${withoutProfile} sin perfil y ${toUpdate.length - withoutProfile} con otro perfil.`
  );
}

async function reportCheckoutConfig(
  query: any,
  logger: any,
  locationIds: string[]
) {
  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["name", "currency_code", "countries.iso_2", "payment_providers.id"],
  });

  const chile = regions.find((r: any) =>
    r.countries?.some((c: any) => c?.iso_2 === "cl")
  );

  if (!chile) {
    logger.warn("⚠ No hay región con Chile (cl).");
  } else {
    if (chile.currency_code !== "clp") {
      logger.warn(`⚠ La región ${chile.name} no está en CLP.`);
    }
    if (!chile.payment_providers?.some((p: any) => p?.id === "pp_system_default")) {
      logger.warn(
        `⚠ La región ${chile.name} no tiene el medio de pago pp_system_default (Cargo beneficio).`
      );
    }
  }

  const { data: taxRegions } = await query.graph({
    entity: "tax_region",
    fields: ["country_code", "provider_id"],
    filters: { country_code: "cl" },
  });

  if (!taxRegions.length || !taxRegions[0].provider_id) {
    logger.warn(
      "⚠ Falta la región de impuestos de Chile o no tiene proveedor (el carrito falla al calcular impuestos)."
    );
  }

  const { data: levels } = await query.graph({
    entity: "inventory_level",
    fields: ["location_id"],
    filters: { location_id: locationIds },
  });

  const withStock = new Set(levels.map((l: any) => l.location_id));
  for (const id of locationIds) {
    if (!withStock.has(id)) {
      logger.warn(`⚠ El site ${id} no tiene stock cargado: no se podrá retirar nada ahí.`);
    }
  }
}
