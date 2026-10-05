import { MedusaContainer, RemoteQueryFunction } from "@medusajs/framework/types";

// Lo que devuelve container.resolve(ContainerRegistrationKeys.QUERY).
type QueryFn = Omit<RemoteQueryFunction, symbol>;
import {
  ContainerRegistrationKeys,
  getVariantAvailability,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils";
import {
  createLocationFulfillmentSetWorkflow,
  createSalesChannelsWorkflow,
  createServiceZonesWorkflow,
  createShippingOptionsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateShippingOptionsWorkflow,
} from "@medusajs/medusa/core-flows";

/*

Sites de retiro (click & collect).

Un "site" es un Stock Location de Medusa configurado así:

  Stock Location (la sala de venta, con su dirección y su stock)
   ├─ Fulfillment set tipo "pickup" → service zone "Chile" (cl)
   │    └─ Shipping option "Retiro en {site}" ($0, proveedor manual)
   ├─ Sales channel propio del site ("Retiro · {site}"), marcado con
   │    metadata.pickup_stock_location_id = <id del stock location>
   └─ Canal de catálogo (el default de la tienda), para que el catálogo
        muestre el stock sumado de todos los sites

Por qué un sales channel por site: en Medusa 2.21 el checkout reserva el
stock en cualquier bodega del sales channel del carrito que tenga
disponibilidad (`prepareConfirmInventoryInput` en core-flows), no en la
bodega de la opción de envío. Con un canal por site, al elegir el site el
carrito pasa a ese canal y la reserva solo puede salir de esa sala. Agregar
productos después también valida el stock de ese site.

La publishable key sigue con un solo canal (el de catálogo): así el
storefront no tiene que mandar `sales_channel_id` al crear carritos ni al
listar productos. El cambio de canal lo hace el backend
(POST /store/carts/:id/pickup-site), que no pasa por la validación de la key.

`ensurePickupSite` deja un Stock Location en ese estado y es idempotente:
lo usan el seed, el script `setup-pickup-sites.ts` y los tests.

*/

export const PICKUP_FULFILLMENT_SET_TYPE = "pickup";
export const SITE_SALES_CHANNEL_METADATA_KEY = "pickup_stock_location_id";
export const PICKUP_SHIPPING_OPTION_CODE = "pickup";
const PICKUP_COUNTRY = "cl";
const MANUAL_PROVIDER_ID = "manual_manual";

export type PickupSiteAddress = {
  address_1?: string | null;
  address_2?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  country_code?: string | null;
  phone?: string | null;
};

export type PickupSite = {
  id: string;
  name: string;
  address: PickupSiteAddress | null;
  sales_channel_id: string;
  shipping_option_id: string;
};

const STOCK_LOCATION_FIELDS = [
  "id",
  "name",
  "address.address_1",
  "address.address_2",
  "address.city",
  "address.province",
  "address.postal_code",
  "address.country_code",
  "address.phone",
  "fulfillment_sets.id",
  "fulfillment_sets.type",
  "fulfillment_sets.service_zones.id",
  "fulfillment_sets.service_zones.shipping_options.id",
  "sales_channels.id",
  "sales_channels.metadata",
  "fulfillment_providers.id",
];

type StockLocationRow = {
  id: string;
  name: string;
  address?: PickupSiteAddress | null;
  fulfillment_sets?: {
    id: string;
    type: string;
    service_zones?: { id: string; shipping_options?: { id: string }[] }[];
  }[];
  sales_channels?: { id: string; metadata?: Record<string, unknown> | null }[];
  fulfillment_providers?: { id: string }[];
};

const toPickupSite = (location: StockLocationRow): PickupSite | null => {
  const pickupSet = location.fulfillment_sets?.find(
    (set) => set?.type === PICKUP_FULFILLMENT_SET_TYPE
  );
  const shippingOptionId = pickupSet?.service_zones
    ?.flatMap((zone) => zone?.shipping_options ?? [])
    .find(Boolean)?.id;
  const salesChannel = location.sales_channels?.find(
    (sc) => sc?.metadata?.[SITE_SALES_CHANNEL_METADATA_KEY] === location.id
  );

  if (!shippingOptionId || !salesChannel) {
    return null;
  }

  return {
    id: location.id,
    name: location.name,
    address: location.address ?? null,
    sales_channel_id: salesChannel.id,
    shipping_option_id: shippingOptionId,
  };
};

const queryLocations = async (
  query: QueryFn,
  filters: Record<string, unknown> = {}
) => {
  const { data } = await query.graph({
    entity: "stock_location",
    fields: STOCK_LOCATION_FIELDS,
    filters,
  });

  return data as unknown as StockLocationRow[];
};

/**
 * Sites de retiro completamente configurados, ordenados por nombre.
 */
export async function listPickupSites(
  query: QueryFn
): Promise<PickupSite[]> {
  const locations = await queryLocations(query);

  return locations
    .map(toPickupSite)
    .filter((site): site is PickupSite => Boolean(site))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/**
 * Un site de retiro configurado, o null si el Stock Location no existe o
 * no está configurado como site.
 */
export async function getPickupSite(
  query: QueryFn,
  stockLocationId: string
): Promise<PickupSite | null> {
  const [location] = await queryLocations(query, { id: stockLocationId });

  return location ? toPickupSite(location) : null;
}

export type UnavailableItem = {
  variant_id: string;
  title: string;
  requested: number;
  available: number;
};

/**
 * Ítems del carrito sin stock suficiente en el sales channel dado (el del
 * site). Ignora variantes sin inventario administrado o con backorder.
 */
export async function findUnavailableItems(
  query: QueryFn,
  items: {
    variant_id?: string | null;
    title?: string | null;
    quantity: number;
    variant?: { manage_inventory?: boolean; allow_backorder?: boolean } | null;
  }[],
  salesChannelId: string
): Promise<UnavailableItem[]> {
  const managed = items.filter(
    (item) =>
      item.variant_id &&
      item.variant?.manage_inventory &&
      !item.variant?.allow_backorder
  );

  if (!managed.length) {
    return [];
  }

  const requested = new Map<string, { title: string; quantity: number }>();
  for (const item of managed) {
    const current = requested.get(item.variant_id!);
    requested.set(item.variant_id!, {
      title: item.title ?? item.variant_id!,
      quantity: (current?.quantity ?? 0) + Number(item.quantity),
    });
  }

  const availability = await getVariantAvailability(query, {
    variant_ids: [...requested.keys()],
    sales_channel_id: salesChannelId,
  });

  const unavailable: UnavailableItem[] = [];
  for (const [variantId, { title, quantity }] of requested) {
    const available = availability[variantId]?.availability ?? 0;
    if (available < quantity) {
      unavailable.push({
        variant_id: variantId,
        title,
        requested: quantity,
        available: Math.max(available, 0),
      });
    }
  }

  return unavailable;
}

export type EnsurePickupSiteInput = {
  stock_location_id: string;
  /** Canal del catálogo (el de la publishable key). Se asocia al site. */
  catalog_sales_channel_id?: string;
  /** Perfil de envío de la opción de retiro. Por defecto, el "default". */
  shipping_profile_id?: string;
};

/**
 * Deja un Stock Location configurado como site de retiro (ver arriba).
 * Idempotente: solo crea lo que falta. Devuelve el site resultante.
 */
export async function ensurePickupSite(
  container: MedusaContainer,
  input: EnsurePickupSiteInput
): Promise<PickupSite> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const fulfillmentModule = container.resolve(Modules.FULFILLMENT);
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL);

  const load = async () => {
    const [location] = await queryLocations(query, {
      id: input.stock_location_id,
    });

    if (!location) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Stock location ${input.stock_location_id} no existe.`
      );
    }

    return location;
  };

  let location = await load();

  // 1. Proveedor de fulfillment manual habilitado en la ubicación.
  if (
    !location.fulfillment_providers?.some((p) => p?.id === MANUAL_PROVIDER_ID)
  ) {
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: location.id },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: MANUAL_PROVIDER_ID },
    });
  }

  // 2. Fulfillment set de retiro.
  let pickupSet = location.fulfillment_sets?.find(
    (set) => set?.type === PICKUP_FULFILLMENT_SET_TYPE
  );

  if (!pickupSet) {
    await createLocationFulfillmentSetWorkflow(container).run({
      input: {
        location_id: location.id,
        fulfillment_set_data: {
          name: `Retiro en ${location.name} (${location.id})`,
          type: PICKUP_FULFILLMENT_SET_TYPE,
        },
      },
    });
    location = await load();
    pickupSet = location.fulfillment_sets!.find(
      (set) => set?.type === PICKUP_FULFILLMENT_SET_TYPE
    )!;
  }

  // 3. Service zone Chile.
  let zone = pickupSet.service_zones?.[0];

  if (!zone) {
    await createServiceZonesWorkflow(container).run({
      input: {
        data: [
          {
            name: `Chile · ${location.name}`,
            fulfillment_set_id: pickupSet.id,
            geo_zones: [{ type: "country", country_code: PICKUP_COUNTRY }],
          },
        ],
      },
    });
    location = await load();
    pickupSet = location.fulfillment_sets!.find(
      (set) => set?.type === PICKUP_FULFILLMENT_SET_TYPE
    )!;
    zone = pickupSet.service_zones![0];
  }

  // 4. Opción de retiro $0.
  if (!zone.shipping_options?.length) {
    let shippingProfileId = input.shipping_profile_id;

    if (!shippingProfileId) {
      const [profile] = await fulfillmentModule.listShippingProfiles({
        type: "default",
      });

      if (!profile) {
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          'No existe un shipping profile "default".'
        );
      }

      shippingProfileId = profile.id;
    }

    await createShippingOptionsWorkflow(container).run({
      input: [
        {
          name: `Retiro en ${location.name}`,
          price_type: "flat",
          provider_id: MANUAL_PROVIDER_ID,
          service_zone_id: zone.id,
          shipping_profile_id: shippingProfileId,
          type: {
            label: "Retiro en sala",
            description: location.name,
            code: PICKUP_SHIPPING_OPTION_CODE,
          },
          prices: [{ currency_code: "clp", amount: 0 }],
          rules: [
            // En 2.21 el valor va sin comillas internas: el '"true"' del seed
            // original del B2B Starter queda guardado como el texto "\"true\""
            // y la opción nunca se lista en la tienda.
            { attribute: "enabled_in_store", value: "true", operator: "eq" },
            { attribute: "is_return", value: "false", operator: "eq" },
          ],
        },
      ],
    });
  }

  // 4b. Reparar reglas de opciones que ya existían (creadas antes en el
  // Admin o con el formato del seed original). Una regla
  // `enabled_in_store = "\"true\""` hace que la opción nunca se liste para
  // un carrito ("Shipping Options are invalid for cart").
  const existingOptionIds = zone.shipping_options?.map((o) => o.id) ?? [];

  if (existingOptionIds.length) {
    const options = await fulfillmentModule.listShippingOptions(
      { id: existingOptionIds },
      { relations: ["rules"] }
    );

    const ruleValue = (option: (typeof options)[number], attribute: string) =>
      (option.rules?.find((r) => r.attribute === attribute)?.value as unknown) ??
      null;

    const toRepair = options.filter(
      (option) =>
        ruleValue(option, "enabled_in_store") !== "true" ||
        ruleValue(option, "is_return") !== "false"
    );

    if (toRepair.length) {
      // `rules` reemplaza todas las reglas de la opción: se conservan las
      // demás tal cual y se reescriben solo estas dos.
      await updateShippingOptionsWorkflow(container).run({
        input: toRepair.map((option) => ({
          id: option.id,
          rules: [
            ...(option.rules ?? [])
              .filter((r) => !["enabled_in_store", "is_return"].includes(r.attribute))
              .map((r) => ({
                attribute: r.attribute,
                operator: r.operator as any,
                value: r.value as unknown as string | string[],
              })),
            { attribute: "enabled_in_store", operator: "eq" as const, value: "true" },
            { attribute: "is_return", operator: "eq" as const, value: "false" },
          ],
        })),
      });
    }
  }

  // 5. Sales channel propio del site.
  const existingChannels = await salesChannelModule.listSalesChannels(
    {},
    { take: null }
  );
  let siteChannel = existingChannels.find(
    (sc) => sc.metadata?.[SITE_SALES_CHANNEL_METADATA_KEY] === location.id
  );

  if (!siteChannel) {
    const { result } = await createSalesChannelsWorkflow(container).run({
      input: {
        salesChannelsData: [
          {
            name: `Retiro · ${location.name}`,
            description:
              "Canal interno del site de retiro. Lo asigna el backend al elegir el site en el carrito; no asociar a la publishable key.",
            metadata: { [SITE_SALES_CHANNEL_METADATA_KEY]: location.id },
          } as any, // CreateSalesChannelDTO no tipa metadata, pero el modelo la guarda
        ],
      },
    });
    siteChannel = result[0];
  }

  // 6. Enlaces sales channel ↔ stock location.
  const linked = new Set((location.sales_channels ?? []).map((sc) => sc?.id));
  const toLink = [siteChannel!.id, input.catalog_sales_channel_id].filter(
    (id): id is string => Boolean(id) && !linked.has(id as string)
  );

  if (toLink.length) {
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: location.id, add: toLink },
    });
  }

  const site = toPickupSite(await load());

  if (!site) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `No se pudo configurar ${location.name} como site de retiro.`
    );
  }

  return site;
}

/**
 * Canal del catálogo: el sales channel por defecto de la tienda.
 */
export async function getCatalogSalesChannelId(
  container: MedusaContainer
): Promise<string | undefined> {
  const storeModule = container.resolve(Modules.STORE);
  const [store] = await storeModule.listStores({}, { take: 1 });

  return store?.default_sales_channel_id ?? undefined;
}
