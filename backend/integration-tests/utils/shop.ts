import { MedusaContainer } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";
import { createInventoryLevelsWorkflow } from "@medusajs/medusa/core-flows";
import { BENEFIT_BUDGET_MODULE } from "../../src/modules/benefit-budget";
import BenefitBudgetModuleService from "../../src/modules/benefit-budget/service";
import { PickupSite } from "../../src/utils/pickup-sites";
import { adminHeaders, createAdminUser, createStoreUser } from "./admin";
import {
  createPickupSite,
  enablePickupScheduling,
  ensureDefaultShippingProfile,
  setFirstPickupDate,
} from "./pickup";
import { salesChannelSeeder } from "./seeder";
import { generatePublishableKey, generateStoreHeaders } from "./store";

/*

Tienda mínima para los tests HTTP de checkout y pedidos (Sonríe Market):
región Chile en CLP, un site de retiro con stock, un colaborador logueado,
la campaña mensual de $50.000 y un producto con dos variantes:

- "1L":    $10.000 (para sumar montos redondos contra el tope).
- "200ml": $999    (para probar el redondeo a pesos enteros con IVA).

Ambas con inventario gestionado y STOCK unidades en el site, así se puede
verificar la reserva y la liberación de stock.

*/

export const STOCK = 100;
export const TOPE = 50000;

export type Shop = {
  container: MedusaContainer;
  service: BenefitBudgetModuleService;
  storeHeaders: { headers: Record<string, string> };
  customerId: string;
  region: any;
  site: PickupSite;
  /** Sales channel del catálogo (para crear otros sites). */
  catalogId: string;
  product: any;
  /** $10.000 */
  litro: string;
  /** $999 */
  chica: string;
  campaignId: string;
};

export const setupShop = async ({
  api,
  getContainer,
}: {
  api: any;
  getContainer: () => MedusaContainer;
}): Promise<Shop> => {
  const container = getContainer();
  const service = container.resolve<BenefitBudgetModuleService>(
    BENEFIT_BUDGET_MODULE
  );

  await createAdminUser(adminHeaders, container);
  const publishableKey = await generatePublishableKey(container);
  const storeHeaders = generateStoreHeaders({ publishableKey }) as any;

  const user = await createStoreUser({ api, storeHeaders });
  storeHeaders.headers["Authorization"] = `Bearer ${user.token}`;

  const region = (
    await api.post(
      "/admin/regions",
      {
        name: "Chile",
        currency_code: "clp",
        countries: ["cl"],
        payment_providers: ["pp_system_default"],
      },
      adminHeaders
    )
  ).data.region;

  const catalog = await salesChannelSeeder({ api, adminHeaders, data: {} });
  await api.post(
    `/admin/api-keys/${publishableKey.id}/sales-channels`,
    { add: [catalog.id] },
    adminHeaders
  );

  const profile = await ensureDefaultShippingProfile(container);
  const site = await createPickupSite(container, {
    name: "Sala Test",
    catalogSalesChannelId: catalog.id,
  });

  // Todo pedido necesita fecha de retiro con cupo (pickup-scheduling).
  await enablePickupScheduling(container);

  const product = (
    await api.post(
      "/admin/products",
      {
        title: "Leche",
        status: "published",
        shipping_profile_id: profile.id,
        options: [{ title: "formato", values: ["1L", "200ml"] }],
        sales_channels: [{ id: catalog.id }],
        variants: [
          {
            title: "1L",
            sku: "LECHE-1L",
            manage_inventory: true,
            prices: [{ currency_code: "clp", amount: 10000 }],
            options: { formato: "1L" },
          },
          {
            title: "200ml",
            sku: "LECHE-200",
            manage_inventory: true,
            prices: [{ currency_code: "clp", amount: 999 }],
            options: { formato: "200ml" },
          },
        ],
      },
      adminHeaders
    )
  ).data.product;

  const byTitle = (t: string) =>
    product.variants.find((v: any) => v.title === t).id as string;

  const query = container.resolve("query");
  const { data: items } = await query.graph({
    entity: "inventory_item",
    fields: ["id"],
    filters: { sku: ["LECHE-1L", "LECHE-200"] },
  });
  await createInventoryLevelsWorkflow(container).run({
    input: {
      inventory_levels: items.map((i: any) => ({
        inventory_item_id: i.id,
        location_id: site.id,
        stocked_quantity: STOCK,
      })),
    },
  });

  const campaign = await service.createBenefitCampaigns({
    nombre: "Beneficio mensual",
    tope_por_colaborador: TOPE,
  });

  return {
    container,
    service,
    storeHeaders,
    customerId: user.customer.id,
    region,
    site,
    catalogId: catalog.id,
    product,
    litro: byTitle("1L"),
    chica: byTitle("200ml"),
    campaignId: campaign.id,
  };
};

type Item = { variant_id: string; quantity: number };

/**
 * Carrito listo para completar: ítems, site de retiro, fecha de retiro (la
 * primera disponible) y sesión de pago "Cargo beneficio"
 * (pp_system_default), igual que el storefront.
 */
export const readyCart = async (
  api: any,
  shop: Shop,
  items: Item[],
  { pay = true, pickupDate = true, headers = shop.storeHeaders } = {}
) => {
  const cart = (
    await api.post(
      "/store/carts",
      { region_id: shop.region.id, email: "test@email.com", items },
      headers
    )
  ).data.cart;

  await api.post(
    `/store/carts/${cart.id}/pickup-site`,
    { stock_location_id: shop.site.id },
    headers
  );

  if (pickupDate) {
    await setFirstPickupDate(api, cart.id, shop.site.id, headers);
  }

  if (pay) {
    await addPaymentSession(api, cart.id, headers);
  }

  return cart;
};

export const addPaymentSession = async (
  api: any,
  cartId: string,
  headers: any
) => {
  const { payment_collection } = (
    await api.post("/store/payment-collections", { cart_id: cartId }, headers)
  ).data;

  await api.post(
    `/store/payment-collections/${payment_collection.id}/payment-sessions`,
    { provider_id: "pp_system_default" },
    headers
  );
};

/** POST /store/carts/:id/complete sin lanzar en 4xx/5xx. */
export const complete = (api: any, cartId: string, headers: any) =>
  api
    .post(`/store/carts/${cartId}/complete`, {}, headers)
    .catch((e: any) => e.response);

export const storeBalance = async (api: any, headers: any) =>
  (await api.get("/store/benefit-budget", headers)).data.benefit_budget;

/** Otro colaborador logueado, con sus propios headers. */
export const createOtherCustomer = async (
  api: any,
  shop: Shop,
  email = "otro@email.com"
) => {
  const base = { ...shop.storeHeaders.headers };
  delete base["Authorization"];

  const register = await api.post("/auth/customer/emailpass/register", {
    email,
    password: "password",
  });
  const customer = (
    await api.post(
      "/store/customers",
      { email },
      { headers: { ...base, Authorization: `Bearer ${register.data.token}` } }
    )
  ).data.customer;
  const login = await api.post("/auth/customer/emailpass", {
    email,
    password: "password",
  });

  return {
    customer,
    headers: { headers: { ...base, Authorization: `Bearer ${login.data.token}` } },
  };
};

/** Reservas de inventario de los ítems de un pedido. */
export const reservationsOf = async (shop: Shop, order: any) =>
  await shop.container
    .resolve(Modules.INVENTORY)
    .listReservationItems({ line_item_id: order.items.map((i: any) => i.id) });

export const waitFor = async (fn: () => Promise<boolean>, ms = 10000) => {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("waitFor: timeout");
};

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
