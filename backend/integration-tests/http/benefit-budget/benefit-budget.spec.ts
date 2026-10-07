import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { BENEFIT_BUDGET_MODULE } from "../../../src/modules/benefit-budget";
import BenefitBudgetModuleService from "../../../src/modules/benefit-budget/service";
import { getPeriod } from "../../../src/modules/benefit-budget/utils/period";
import benefitBudgetPeriodJob from "../../../src/jobs/benefit-budget-period";
import { refundBenefitBudgetWorkflow } from "../../../src/workflows/benefit-budget/workflows";
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

Flujo completo del beneficio contra la API (npm run test:integration:http):
saldo en storefront, consumo en el checkout, bloqueo al exceder, pedido
asociado al consumo, reintegro al anular, override desde el Admin, campaña
inactiva y job de apertura de periodo.

*/

const waitFor = async (fn: () => Promise<boolean>, ms = 10000) => {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("waitFor: timeout");
};

medusaIntegrationTestRunner({
  inApp: true,
  env: { JWT_SECRET: "supersecret" },
  testSuite: ({ api, getContainer }) => {
    let storeHeaders: any;
    let customerId: string;
    let region: any;
    let product: any;
    let salesChannel: any;
    let service: BenefitBudgetModuleService;
    let site: { id: string };

    const createCartWith = async (amountQuantity: number) => {
      const cart = (
        await api.post(
          "/store/carts",
          {
            region_id: region.id,
            sales_channel_id: salesChannel.id,
            email: "test@email.com",
            items: [
              { variant_id: product.variants[0].id, quantity: amountQuantity },
            ],
          },
          storeHeaders
        )
      ).data.cart;

      // Todo pedido necesita site y fecha de retiro (validate-cart-completion).
      await api.post(
        `/store/carts/${cart.id}/pickup-site`,
        { stock_location_id: site.id },
        storeHeaders
      );
      await setFirstPickupDate(api, cart.id, site.id, storeHeaders);

      const collection = (
        await api.post(
          "/store/payment-collections",
          { cart_id: cart.id },
          storeHeaders
        )
      ).data.payment_collection;

      await api.post(
        `/store/payment-collections/${collection.id}/payment-sessions`,
        { provider_id: "pp_system_default" },
        storeHeaders
      );

      return cart;
    };

    const storeBalance = async () =>
      (await api.get("/store/benefit-budget", storeHeaders)).data
        .benefit_budget;

    beforeEach(async () => {
      const container = getContainer();
      service = container.resolve(BENEFIT_BUDGET_MODULE);

      await createAdminUser(adminHeaders, container);
      const publishableKey = await generatePublishableKey(container);
      storeHeaders = generateStoreHeaders({ publishableKey });

      const user = await createStoreUser({ api, storeHeaders });
      customerId = user.customer.id;
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

      salesChannel = await salesChannelSeeder({ api, adminHeaders, data: {} });
      const profile = await ensureDefaultShippingProfile(container);
      site = await createPickupSite(container, {
        name: "Sala Test",
        catalogSalesChannelId: salesChannel.id,
      });
      await enablePickupScheduling(container);

      product = (
        await api.post(
          "/admin/products",
          {
            title: "Leche",
            status: "published",
            shipping_profile_id: profile.id,
            options: [{ title: "formato", values: ["1L"] }],
            sales_channels: [{ id: salesChannel.id }],
            variants: [
              {
                title: "1L",
                manage_inventory: false,
                prices: [{ currency_code: "clp", amount: 10000 }],
                options: { formato: "1L" },
              },
            ],
          },
          adminHeaders
        )
      ).data.product;

      await api.post(
        `/admin/api-keys/${publishableKey.id}/sales-channels`,
        { add: [salesChannel.id] },
        adminHeaders
      );

      await service.createBenefitCampaigns({
        nombre: "Beneficio mensual",
        tope_por_colaborador: 50000,
      });
    });

    it("muestra el saldo completo antes de comprar", async () => {
      expect(await storeBalance()).toEqual(
        expect.objectContaining({
          periodo: getPeriod(),
          tope: 50000,
          consumido: 0,
          disponible: 50000,
        })
      );
    });

    it("exige sesión para ver el saldo", async () => {
      const { Authorization, ...headers } = storeHeaders.headers;
      const res = await api
        .get("/store/benefit-budget", { headers })
        .catch((e) => e.response);
      expect(res.status).toBe(401);
    });

    it("consume en el checkout, bloquea al exceder y reintegra al anular", async () => {
      // 1. Compra de $30.000
      const cart1 = await createCartWith(3);
      const done = (
        await api.post(`/store/carts/${cart1.id}/complete`, {}, storeHeaders)
      ).data;
      expect(done.type).toBe("order");
      const orderId = done.order.id;

      expect(await storeBalance()).toEqual(
        expect.objectContaining({ consumido: 30000, disponible: 20000 })
      );

      // 2. El subscriber de order.placed asocia el consumo al pedido
      await waitFor(async () => {
        const [m] = await service.listBenefitMovements({ cart_id: cart1.id });
        return m?.order_id === orderId;
      });

      // 3. Segunda compra de $30.000: excede (20.000 disponibles)
      const cart2 = await createCartWith(3);
      const fail = await api
        .post(`/store/carts/${cart2.id}/complete`, {}, storeHeaders)
        .catch((e) => e.response);
      expect(fail.status).toBe(400);
      expect(fail.data.message).toContain("Saldo de beneficio insuficiente");
      expect((await storeBalance()).consumido).toBe(30000);

      // 4. Anulación desde el Admin: reintegro
      await api.post(`/admin/orders/${orderId}/cancel`, {}, adminHeaders);

      await waitFor(async () => (await storeBalance()).consumido === 0);

      // 5. Ahora la segunda compra sí pasa
      const ok = (
        await api.post(`/store/carts/${cart2.id}/complete`, {}, storeHeaders)
      ).data;
      expect(ok.type).toBe("order");
      expect((await storeBalance()).consumido).toBe(30000);

      // 6. Vista del Admin: movimientos con número de pedido
      await waitFor(async () => {
        const [m] = await service.listBenefitMovements({ cart_id: cart2.id });
        return Boolean(m?.order_id);
      });

      const admin = (
        await api.get(
          `/admin/benefit-budget/customers/${customerId}`,
          adminHeaders
        )
      ).data;

      expect(admin.benefit_budget).toEqual(
        expect.objectContaining({ tope: 50000, consumido: 30000 })
      );
      expect(admin.movimientos.map((m) => m.tipo).sort()).toEqual([
        "consumo",
        "consumo",
        "reintegro",
      ]);
      expect(
        admin.movimientos.every((m) => typeof m.order_display_id === "number")
      ).toBe(true);
    });

    it("una segunda anulación del mismo pedido no reintegra dos veces", async () => {
      const cart = await createCartWith(2);
      const { order } = (
        await api.post(`/store/carts/${cart.id}/complete`, {}, storeHeaders)
      ).data;

      await api.post(`/admin/orders/${order.id}/cancel`, {}, adminHeaders);
      await waitFor(async () => (await storeBalance()).consumido === 0);

      const { result } = await refundBenefitBudgetWorkflow(
        getContainer()
      ).run({ input: { order_id: order.id } });

      expect(result?.created).toBe(false);
      expect((await storeBalance()).consumido).toBe(0);
    });

    it("el override del Admin amplía el tope del colaborador", async () => {
      const res = await api.post(
        `/admin/benefit-budget/customers/${customerId}/override`,
        { tope_override: 70000 },
        adminHeaders
      );
      expect(res.data.benefit_budget).toEqual(
        expect.objectContaining({ tope: 70000, tope_override: 70000 })
      );

      const cart = await createCartWith(6);
      const done = (
        await api.post(`/store/carts/${cart.id}/complete`, {}, storeHeaders)
      ).data;
      expect(done.type).toBe("order");
      expect(await storeBalance()).toEqual(
        expect.objectContaining({ tope: 70000, consumido: 60000 })
      );

      // quitar el override no puede dejar el saldo negativo
      await api.post(
        `/admin/benefit-budget/customers/${customerId}/override`,
        { tope_override: null },
        adminHeaders
      );
      expect(await storeBalance()).toEqual(
        expect.objectContaining({ tope: 50000, disponible: 0 })
      );
    });

    it("valida el body del override", async () => {
      const res = await api
        .post(
          `/admin/benefit-budget/customers/${customerId}/override`,
          { tope_override: -5 },
          adminHeaders
        )
        .catch((e) => e.response);
      expect(res.status).toBe(400);
    });

    it("sin campaña activa, el saldo es null y el checkout se bloquea", async () => {
      const { campaigns } = (
        await api.get("/admin/benefit-budget/campaigns", adminHeaders)
      ).data;
      await api.post(
        `/admin/benefit-budget/campaigns/${campaigns[0].id}`,
        { estado: "inactiva" },
        adminHeaders
      );

      expect(await storeBalance()).toBeNull();

      const cart = await createCartWith(1);
      const fail = await api
        .post(`/store/carts/${cart.id}/complete`, {}, storeHeaders)
        .catch((e) => e.response);
      expect(fail.status).toBe(400);
      expect(fail.data.message).toContain("No hay una campaña");
    });

    it("no permite dos campañas mensuales activas", async () => {
      const other = await service.createBenefitCampaigns({
        nombre: "Otra",
        tope_por_colaborador: 1000,
        estado: "inactiva",
      });

      const res = await api
        .post(
          `/admin/benefit-budget/campaigns/${other.id}`,
          { estado: "activa" },
          adminHeaders
        )
        .catch((e) => e.response);
      expect(res.status).toBe(400);
    });

    it("el job abre el periodo para todos los colaboradores (idempotente)", async () => {
      await benefitBudgetPeriodJob(getContainer());
      await benefitBudgetPeriodJob(getContainer());

      const budgets = await service.listEmployeeBudgets({
        customer_id: customerId,
        periodo: getPeriod(),
      });
      expect(budgets).toHaveLength(1);
      expect(budgets[0]).toEqual(
        expect.objectContaining({ tope: 50000, consumido: 0 })
      );
    });
  },
});
