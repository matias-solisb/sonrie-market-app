import {
  createApiKeysWorkflow,
  createCollectionsWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createProductTagsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  updateStoresWorkflow,
} from "@medusajs/core-flows";
import { ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";

import { ensurePickupSite } from "../utils/pickup-sites";
import { ensureBenefitCampaign } from "./seed-benefit-campaign";

/*

Seed de una base NUEVA de Sonríe Market (DEV local / pruebas). No es
idempotente: correr una sola vez sobre una base vacía (`npm run seed`).

Deja:
- Tienda en CLP con precios con IVA incluido, región "Chile" (cl) con el
  medio de pago "Cargo beneficio" (`pp_system_default`) e IVA 19 %
  (proveedor `tp_system`).
- Dos sites de retiro DE PRUEBA (direcciones ficticias), cada uno con su
  opción "Retiro en {site}" $0 y su sales channel (src/utils/pickup-sites.ts).
- Canal de catálogo ("Default Sales Channel") en la publishable key.
- Productos lácteos de ejemplo con precios en CLP y stock distinto por
  site (uno solo tiene stock en Santiago, para probar el stock por site).
- Campaña de beneficio de $50.000.

Para una base que ya tiene datos (DEV/PRD) no usar este seed: configurar
los sites con `npx medusa exec ./src/scripts/setup-pickup-sites.ts`.

*/

const DEMO_SITES = [
  {
    name: "Sala de venta Santiago (demo)",
    address: {
      address_1: "Dirección de prueba 100",
      city: "Santiago",
      province: "Región Metropolitana",
      postal_code: "8320000",
      country_code: "CL",
    },
  },
  {
    name: "Sala de venta Sur (demo)",
    address: {
      address_1: "Dirección de prueba 200",
      city: "Temuco",
      province: "Región de La Araucanía",
      postal_code: "4780000",
      country_code: "CL",
    },
  },
];

type DemoProduct = {
  title: string;
  handle: string;
  category: string;
  description: string;
  sku: string;
  price: number;
  featured?: boolean;
  /** Stock por site, en el orden de DEMO_SITES. */
  stock: [number, number];
};

const DEMO_PRODUCTS: DemoProduct[] = [
  {
    title: "Leche entera 1 L",
    handle: "leche-entera-1l",
    category: "Leches",
    description: "Leche entera UHT, caja de 1 litro.",
    sku: "DEMO-LECHE-ENTERA-1L",
    price: 1190,
    featured: true,
    stock: [200, 120],
  },
  {
    title: "Leche descremada 1 L",
    handle: "leche-descremada-1l",
    category: "Leches",
    description: "Leche descremada UHT, caja de 1 litro.",
    sku: "DEMO-LECHE-DESCREMADA-1L",
    price: 1190,
    stock: [150, 80],
  },
  {
    title: "Yogur batido frutilla 125 g",
    handle: "yogur-batido-frutilla-125g",
    category: "Yogures",
    description: "Yogur batido sabor frutilla, pote de 125 g.",
    sku: "DEMO-YOGUR-FRUTILLA-125G",
    price: 390,
    featured: true,
    stock: [300, 300],
  },
  {
    title: "Queso gauda laminado 250 g",
    handle: "queso-gauda-laminado-250g",
    category: "Quesos y mantequillas",
    description: "Queso gauda laminado, envase de 250 g.",
    sku: "DEMO-QUESO-GAUDA-250G",
    price: 3290,
    featured: true,
    stock: [60, 40],
  },
  {
    title: "Mantequilla con sal 250 g",
    handle: "mantequilla-con-sal-250g",
    category: "Quesos y mantequillas",
    description: "Mantequilla con sal, pan de 250 g.",
    sku: "DEMO-MANTEQUILLA-250G",
    price: 2590,
    stock: [80, 50],
  },
  {
    title: "Manjar 400 g",
    handle: "manjar-400g",
    category: "Postres",
    description: "Manjar tradicional, pote de 400 g. Solo en Santiago (demo de stock por site).",
    sku: "DEMO-MANJAR-400G",
    price: 2190,
    stock: [40, 0],
  },
];

export default async function seedDemoData({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const salesChannelModule = container.resolve(Modules.SALES_CHANNEL);
  const storeModule = container.resolve(Modules.STORE);

  logger.info("Seeding store data...");
  const [store] = await storeModule.listStores();
  let catalogChannel = (
    await salesChannelModule.listSalesChannels({
      name: "Default Sales Channel",
    })
  )[0];

  if (!catalogChannel) {
    const { result } = await createSalesChannelsWorkflow(container).run({
      input: {
        salesChannelsData: [
          {
            name: "Default Sales Channel",
            description:
              "Canal del catálogo (publishable key). Ve el stock de todos los sites.",
          },
        ],
      },
    });
    catalogChannel = result[0];
  }

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        name: "Sonríe Market",
        supported_currencies: [
          { currency_code: "clp", is_default: true, is_tax_inclusive: true },
        ],
        default_sales_channel_id: catalogChannel.id,
      },
    },
  });

  logger.info("Seeding region data...");
  await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: "Chile",
          currency_code: "clp",
          countries: ["cl"],
          payment_providers: ["pp_system_default"],
          automatic_taxes: true,
          is_tax_inclusive: true,
        },
      ],
    },
  });

  logger.info("Seeding tax regions...");
  await createTaxRegionsWorkflow(container).run({
    input: [
      {
        country_code: "cl",
        provider_id: "tp_system",
        default_tax_rate: { rate: 19, code: "IVA", name: "IVA" },
      },
    ],
  });

  logger.info("Seeding shipping profile...");
  const {
    result: [shippingProfile],
  } = await createShippingProfilesWorkflow(container).run({
    input: { data: [{ name: "Default", type: "default" }] },
  });

  logger.info("Seeding pickup sites (demo)...");
  const { result: locations } = await createStockLocationsWorkflow(
    container
  ).run({
    input: { locations: DEMO_SITES },
  });

  for (const location of locations) {
    const site = await ensurePickupSite(container, {
      stock_location_id: location.id,
      catalog_sales_channel_id: catalogChannel.id,
      shipping_profile_id: shippingProfile.id,
    });
    logger.info(`  Site listo: ${site.name}`);
  }

  logger.info("Seeding publishable API key data...");
  const {
    result: [publishableApiKey],
  } = await createApiKeysWorkflow(container).run({
    input: {
      api_keys: [{ title: "Webshop", type: "publishable", created_by: "" }],
    },
  });

  // Solo el canal de catálogo: los canales de site no van en la key (ver
  // src/utils/pickup-sites.ts).
  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: { id: publishableApiKey.id, add: [catalogChannel.id] },
  });

  logger.info("Seeding product data...");
  const {
    result: [collection],
  } = await createCollectionsWorkflow(container).run({
    input: { collections: [{ title: "Featured", handle: "featured" }] },
  });

  const categoryNames = [...new Set(DEMO_PRODUCTS.map((p) => p.category))];
  const { result: categories } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: categoryNames.map((name) => ({
        name,
        is_active: true,
      })),
    },
  });

  const {
    result: [featuredTag],
  } = await createProductTagsWorkflow(container).run({
    input: { product_tags: [{ value: "featured" }] },
  });

  await createProductsWorkflow(container).run({
    input: {
      products: DEMO_PRODUCTS.map((product) => ({
        title: product.title,
        handle: product.handle,
        description: product.description,
        status: ProductStatus.PUBLISHED,
        shipping_profile_id: shippingProfile.id,
        collection_id: product.featured ? collection.id : undefined,
        tag_ids: product.featured ? [featuredTag.id] : [],
        category_ids: [categories.find((c) => c.name === product.category)!.id],
        options: [{ title: "Formato", values: ["Único"] }],
        variants: [
          {
            title: "Único",
            sku: product.sku,
            options: { Formato: "Único" },
            manage_inventory: true,
            prices: [{ amount: product.price, currency_code: "clp" }],
          },
        ],
        sales_channels: [{ id: catalogChannel.id }],
      })),
    },
  });

  logger.info("Seeding inventory levels per site...");
  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id", "sku"],
    filters: { sku: DEMO_PRODUCTS.map((p) => p.sku) },
  });

  await createInventoryLevelsWorkflow(container).run({
    input: {
      inventory_levels: DEMO_PRODUCTS.flatMap((product) => {
        const item = inventoryItems.find((i) => i.sku === product.sku)!;

        return locations
          .map((location, index) => ({
            inventory_item_id: item.id,
            location_id: location.id,
            stocked_quantity: product.stock[index],
          }))
          .filter((level) => level.stocked_quantity > 0);
      }),
    },
  });

  logger.info("Finished seeding product data.");

  logger.info("Seeding benefit campaign...");
  await ensureBenefitCampaign(container);
  logger.info("Finished seeding benefit campaign.");
}
