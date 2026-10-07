import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { Modules } from "@medusajs/framework/utils";
import { createInventoryLevelsWorkflow } from "@medusajs/medusa/core-flows";
import { BENEFIT_BUDGET_MODULE } from "../../../src/modules/benefit-budget";
import { ensurePickupSite, PickupSite } from "../../../src/utils/pickup-sites";
import {
  adminHeaders,
  createAdminUser,
  createStoreUser,
} from "../../utils/admin";
import {
  createPickupSite,
  enablePickupScheduling,
  ensureDefaultShippingProfile,
  setFirstPickupDate,
} from "../../utils/pickup";
import { salesChannelSeeder } from "../../utils/seeder";
import {
  generatePublishableKey,
  generateStoreHeaders,
} from "../../utils/store";

jest.setTimeout(120 * 1000);

/*

Retiro por site y stock por site (npm run test:integration:http):
- /store/stock-locations lista solo sites configurados;
- POST /store/carts/:id/pickup-site deja el carrito en el canal del site,
  con su dirección, su opción de retiro y avisa ítems sin stock;
- el checkout exige site y reserva el stock en ESA sala;
- ensurePickupSite es idempotente.

*/
medusaIntegrationTestRunner({
  inApp: true,
  env: { JWT_SECRET: "supersecret" },
  testSuite: ({ api, getContainer }) => {
    let storeHeaders: any;
    let region: any;
    let catalog: any;
    let variantId: string;
    let santiago: PickupSite;
    let sur: PickupSite;

    beforeEach(async () => {
      const container = getContainer();
      await createAdminUser(adminHeaders, container);
      const publishableKey = await generatePublishableKey(container);
      storeHeaders = generateStoreHeaders({ publishableKey });

      const user = await createStoreUser({ api, storeHeaders });
      storeHeaders.headers["Authorization"] = `Bearer ${user.token}`;

      region = (
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

      catalog = await salesChannelSeeder({ api, adminHeaders, data: {} });
      await api.post(
        `/admin/api-keys/${publishableKey.id}/sales-channels`,
        { add: [catalog.id] },
        adminHeaders
      );

      const profile = await ensureDefaultShippingProfile(container);
      santiago = await createPickupSite(container, {
        name: "Santiago",
        catalogSalesChannelId: catalog.id,
      });
      sur = await createPickupSite(container, {
        name: "Sur",
        catalogSalesChannelId: catalog.id,
      });
      await enablePickupScheduling(container);

      const product = (
        await api.post(
          "/admin/products",
          {
            title: "Manjar",
            status: "published",
            shipping_profile_id: profile.id,
            options: [{ title: "formato", values: ["400g"] }],
            sales_channels: [{ id: catalog.id }],
            variants: [
              {
                title: "400g",
                sku: "MANJAR-TEST",
                manage_inventory: true,
                prices: [{ currency_code: "clp", amount: 2000 }],
                options: { formato: "400g" },
              },
            ],
          },
          adminHeaders
        )
      ).data.product;
      variantId = product.variants[0].id;

      // Stock solo en Santiago
      const query = container.resolve("query");
      const {
        data: [item],
      } = await query.graph({
        entity: "inventory_item",
        fields: ["id"],
        filters: { sku: "MANJAR-TEST" },
      });
      await createInventoryLevelsWorkflow(container).run({
        input: {
          inventory_levels: [
            { inventory_item_id: item.id, location_id: santiago.id, stocked_quantity: 5 },
          ],
        },
      });

      await container.resolve(BENEFIT_BUDGET_MODULE).createBenefitCampaigns({
        nombre: "Beneficio mensual",
        tope_por_colaborador: 50000,
      });
    });

    const newCart = async (quantity: number) =>
      (
        await api.post(
          "/store/carts",
          {
            region_id: region.id,
            items: [{ variant_id: variantId, quantity }],
          },
          storeHeaders
        )
      ).data.cart;

    const setSite = (cartId: string, stockLocationId: string, headers = storeHeaders) =>
      api
        .post(
          `/store/carts/${cartId}/pickup-site`,
          { stock_location_id: stockLocationId },
          headers
        )
        .catch((e) => e.response);

    const pay = async (cartId: string) => {
      const { payment_collection } = (
        await api.post("/store/payment-collections", { cart_id: cartId }, storeHeaders)
      ).data;
      await api.post(
        `/store/payment-collections/${payment_collection.id}/payment-sessions`,
        { provider_id: "pp_system_default" },
        storeHeaders
      );
    };

    const complete = (cartId: string) =>
      api
        .post(`/store/carts/${cartId}/complete`, {}, storeHeaders)
        .catch((e) => e.response);

    it("lista solo los sites configurados", async () => {
      const container = getContainer();
      await container.resolve(Modules.STOCK_LOCATION).createStockLocations({
        name: "Bodega sin configurar",
      });

      const { stock_locations } = (
        await api.get("/store/stock-locations", storeHeaders)
      ).data;

      expect(stock_locations.map((s) => s.name)).toEqual(["Santiago", "Sur"]);
      expect(stock_locations[0]).not.toHaveProperty("sales_channel_id");
    });

    it("elige el site: canal, dirección, retiro y aviso de stock", async () => {
      const cart = await newCart(2);
      expect(cart.sales_channel_id).toBe(catalog.id);

      const resSur = await setSite(cart.id, sur.id);
      expect(resSur.status).toBe(200);
      expect(resSur.data.cart.sales_channel_id).toBe(sur.sales_channel_id);
      expect(resSur.data.cart.shipping_address.address_1).toBe("Dirección de prueba Sur");
      expect(resSur.data.cart.billing_address.address_1).toBe("Dirección de prueba Sur");
      expect(resSur.data.cart.email).toBe("test@email.com");
      expect(resSur.data.cart.metadata.stock_location_id).toBe(sur.id);
      expect(resSur.data.cart.shipping_methods).toHaveLength(1);
      expect(resSur.data.cart.shipping_methods[0].shipping_option_id).toBe(
        sur.shipping_option_id
      );
      expect(resSur.data.unavailable_items).toEqual([
        expect.objectContaining({ variant_id: variantId, requested: 2, available: 0 }),
      ]);

      // Cambiar de site reemplaza el método de retiro
      const resStgo = await setSite(cart.id, santiago.id);
      expect(resStgo.data.cart.sales_channel_id).toBe(santiago.sales_channel_id);
      expect(resStgo.data.cart.shipping_methods).toHaveLength(1);
      expect(resStgo.data.cart.shipping_methods[0].shipping_option_id).toBe(
        santiago.shipping_option_id
      );
      expect(resStgo.data.unavailable_items).toEqual([]);
    });

    it("compra en Santiago y reserva el stock en Santiago", async () => {
      const cart = await newCart(2);
      await setSite(cart.id, santiago.id);
      await setFirstPickupDate(api, cart.id, santiago.id, storeHeaders);
      await pay(cart.id);

      const res = await complete(cart.id);
      expect(res.status).toBe(200);
      expect(res.data.type).toBe("order");

      const container = getContainer();
      const reservations = await container
        .resolve(Modules.INVENTORY)
        .listReservationItems({ line_item_id: res.data.order.items.map((i) => i.id) });

      expect(reservations.map((r) => r.location_id)).toEqual([santiago.id]);
    });

    it("sin stock en el site elegido, el checkout responde en español", async () => {
      const cart = await newCart(2);
      await setSite(cart.id, sur.id);
      await pay(cart.id);

      const res = await complete(cart.id);
      expect(res.status).toBe(400);
      expect(res.data.message).toBe(
        "No hay stock suficiente en Sur para: Manjar (pediste 2, quedan 0)."
      );
    });

    it("agregar productos después de elegir el site valida el stock de ese site", async () => {
      const cart = await newCart(1);
      await setSite(cart.id, santiago.id);

      const res = await api
        .post(
          `/store/carts/${cart.id}/line-items`,
          { variant_id: variantId, quantity: 10 },
          storeHeaders
        )
        .catch((e) => e.response);
      expect(res.status).toBe(400);
    });

    it("sin site elegido no se puede completar", async () => {
      const cart = await newCart(1);
      await pay(cart.id);

      const res = await complete(cart.id);
      expect(res.status).toBe(400);
      expect(res.data.message).toBe(
        "Elige un site de retiro en el carrito antes de confirmar el pedido."
      );
    });

    it("si el carrito se sale del canal del site, el checkout lo rechaza", async () => {
      const cart = await newCart(1);
      await setSite(cart.id, santiago.id);
      await pay(cart.id);

      // Alguien vuelve el carrito al canal de catálogo por la Store API
      await api.post(
        `/store/carts/${cart.id}`,
        { sales_channel_id: catalog.id },
        storeHeaders
      );

      const res = await complete(cart.id);
      expect(res.status).toBe(400);
      expect(res.data.message).toContain("no está preparado para retiro en Santiago");
    });

    it("otro colaborador no puede cambiar el site de mi carrito", async () => {
      const cart = await newCart(1);

      const register = await api.post("/auth/customer/emailpass/register", {
        email: "otro@email.com",
        password: "password",
      });
      await api.post(
        "/store/customers",
        { email: "otro@email.com" },
        {
          headers: {
            ...storeHeaders.headers,
            Authorization: `Bearer ${register.data.token}`,
          },
        }
      );
      const login = await api.post("/auth/customer/emailpass", {
        email: "otro@email.com",
        password: "password",
      });

      const res = await setSite(cart.id, santiago.id, {
        headers: { ...storeHeaders.headers, Authorization: `Bearer ${login.data.token}` },
      });
      expect(res.status).toBe(404);
    });

    it("rechaza un site inexistente o no configurado", async () => {
      const cart = await newCart(1);
      const res = await setSite(cart.id, "sloc_no_existe");
      expect(res.status).toBe(400);
      expect(res.data.message).toBe("El site de retiro elegido no está disponible.");
    });

    it("ensurePickupSite es idempotente", async () => {
      const container = getContainer();
      const again = await ensurePickupSite(container, {
        stock_location_id: santiago.id,
        catalog_sales_channel_id: catalog.id,
      });
      expect(again).toEqual(santiago);

      const channels = await container
        .resolve(Modules.SALES_CHANNEL)
        .listSalesChannels({});
      // catálogo + default del test runner? solo contamos los de site
      expect(
        channels.filter((c) => c.metadata?.pickup_stock_location_id).length
      ).toBe(2);

      const options = await container
        .resolve(Modules.FULFILLMENT)
        .listShippingOptions({});
      expect(options).toHaveLength(2);
    });
  },
});
