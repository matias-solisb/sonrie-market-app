import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { Modules } from "@medusajs/framework/utils";
import { adminHeaders } from "../../utils/admin";
import {
  addPaymentSession,
  complete,
  readyCart,
  setupShop,
  Shop,
  storeBalance,
  STOCK,
  TOPE,
} from "../../utils/shop";

jest.setTimeout(120 * 1000);

/*

Escenarios comunes de checkout contra el cupo de beneficio
(npm run test:integration:http):

1. Carrito con varios productos: se consume el total del carrito.
2. Total con IVA y fracciones de peso: se consume el total redondeado.
3. Código de descuento: se consume el total con descuento.
4. Descuento del 100 % (total $0): pedido creado sin consumo.
5. Dos checkouts simultáneos que juntos pasan el tope: solo uno entra.
6. Doble envío del mismo carrito: un pedido y un consumo.
7. Falla después de reservar el cupo: se compensa y se puede reintentar.
8. Override por debajo de lo consumido: disponible 0, nunca negativo.

Complementa a benefit-budget.spec.ts (flujo base, anulación, override,
campaña inactiva y job).

*/
medusaIntegrationTestRunner({
  inApp: true,
  env: { JWT_SECRET: "supersecret" },
  testSuite: ({ api, getContainer }) => {
    let shop: Shop;

    beforeEach(async () => {
      shop = await setupShop({ api, getContainer });
    });

    const balance = () => storeBalance(api, shop.storeHeaders);

    const createPromotion = async (
      code: string,
      application_method: Record<string, unknown>
    ) =>
      (
        await api.post(
          "/admin/promotions",
          {
            code,
            type: "standard",
            status: "active",
            is_automatic: false,
            application_method: {
              target_type: "items",
              allocation: "across",
              currency_code: "clp",
              ...application_method,
            },
          },
          adminHeaders
        )
      ).data.promotion;

    it("1. con varios productos consume el total del carrito", async () => {
      // 2 × $10.000 + 3 × $999 = $22.997
      const cart = await readyCart(api, shop, [
        { variant_id: shop.litro, quantity: 2 },
        { variant_id: shop.chica, quantity: 3 },
      ]);

      const res = await complete(api, cart.id, shop.storeHeaders);
      expect(res.status).toBe(200);
      expect(res.data.type).toBe("order");
      expect(res.data.order.total).toBe(22997);

      expect(await balance()).toEqual(
        expect.objectContaining({ consumido: 22997, disponible: TOPE - 22997 })
      );
    });

    it("2. con IVA consume el total con impuesto, redondeado a pesos", async () => {
      await api.post(
        "/admin/tax-regions",
        {
          country_code: "cl",
          provider_id: "tp_system",
          default_tax_rate: { name: "IVA", code: "IVA", rate: 19 },
        },
        adminHeaders
      );

      // $999 + 19 % = $1.188,81 → $1.189
      const cart = await readyCart(api, shop, [
        { variant_id: shop.chica, quantity: 1 },
      ]);

      const res = await complete(api, cart.id, shop.storeHeaders);
      expect(res.status).toBe(200);
      expect(Math.round(res.data.order.total)).toBe(1189);

      const { consumido } = await balance();
      expect(consumido).toBe(1189);
      expect(Number.isInteger(consumido)).toBe(true);
    });

    it("3. con código de descuento consume el total ya descontado", async () => {
      await createPromotion("DESC5000", { type: "fixed", value: 5000 });

      // Como en el storefront: el código se aplica en el carrito y la sesión
      // de pago se crea después, en el checkout (aplicar un código borra las
      // sesiones de pago existentes).
      const cart = await readyCart(
        api,
        shop,
        [{ variant_id: shop.litro, quantity: 3 }],
        { pay: false }
      );
      const withPromo = (
        await api.post(
          `/store/carts/${cart.id}/promotions`,
          { promo_codes: ["DESC5000"] },
          shop.storeHeaders
        )
      ).data.cart;
      expect(withPromo.total).toBe(25000);
      await addPaymentSession(api, cart.id, shop.storeHeaders);

      const res = await complete(api, cart.id, shop.storeHeaders);
      expect(res.status).toBe(200);
      expect((await balance()).consumido).toBe(25000);
    });

    it("4. con descuento del 100 % (total $0) crea el pedido sin consumir cupo", async () => {
      await createPromotion("GRATIS", { type: "percentage", value: 100 });

      const cart = await readyCart(
        api,
        shop,
        [{ variant_id: shop.litro, quantity: 1 }],
        { pay: false }
      );
      const withPromo = (
        await api.post(
          `/store/carts/${cart.id}/promotions`,
          { promo_codes: ["GRATIS"] },
          shop.storeHeaders
        )
      ).data.cart;
      expect(withPromo.total).toBe(0);
      await addPaymentSession(api, cart.id, shop.storeHeaders);

      const res = await complete(api, cart.id, shop.storeHeaders);
      expect(res.status).toBe(200);
      expect(res.data.type).toBe("order");

      expect((await balance()).consumido).toBe(0);
      expect(await shop.service.listBenefitMovements({})).toHaveLength(0);
    });

    it("5. dos checkouts simultáneos que juntos pasan el tope: solo uno entra", async () => {
      // $30.000 cada uno; juntos $60.000 > $50.000
      const cartA = await readyCart(api, shop, [
        { variant_id: shop.litro, quantity: 3 },
      ]);
      const cartB = await readyCart(api, shop, [
        { variant_id: shop.litro, quantity: 3 },
      ]);

      const results = await Promise.all([
        complete(api, cartA.id, shop.storeHeaders),
        complete(api, cartB.id, shop.storeHeaders),
      ]);

      const ok = results.filter((r) => r.status === 200);
      const rejected = results.filter((r) => r.status !== 200);

      expect(ok).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].status).toBe(400);
      expect(rejected[0].data.message).toContain(
        "Saldo de beneficio insuficiente"
      );

      expect((await balance()).consumido).toBe(30000);
      expect(
        await shop.service.listBenefitMovements({ tipo: "consumo" })
      ).toHaveLength(1);
    });

    it("6. enviar el mismo carrito dos veces crea UN pedido y UN consumo", async () => {
      const cart = await readyCart(api, shop, [
        { variant_id: shop.litro, quantity: 2 },
      ]);

      const results = await Promise.all([
        complete(api, cart.id, shop.storeHeaders),
        complete(api, cart.id, shop.storeHeaders),
      ]);

      const orderIds = new Set(
        results
          .filter((r) => r.status === 200 && r.data.type === "order")
          .map((r) => r.data.order.id)
      );
      expect(orderIds.size).toBe(1);

      // Un tercer intento, ya completado, tampoco descuenta de nuevo
      await complete(api, cart.id, shop.storeHeaders);

      const { data: orders } = await shop.container
        .resolve("query")
        .graph({ entity: "order", fields: ["id"] });
      expect(orders).toHaveLength(1);
      expect((await balance()).consumido).toBe(20000);
      expect(
        await shop.service.listBenefitMovements({ cart_id: cart.id })
      ).toHaveLength(1);
    });

    it("7. si el checkout falla después de reservar el cupo, el saldo vuelve y se puede reintentar", async () => {
      const cart = await readyCart(api, shop, [
        { variant_id: shop.litro, quantity: 2 },
      ]);

      // La reserva de stock corre DESPUÉS del hook que descuenta el cupo.
      const inventory = shop.container.resolve(Modules.INVENTORY);
      const spy = jest
        .spyOn(inventory, "createReservationItems")
        .mockRejectedValueOnce(new Error("Falla simulada al reservar stock"));

      const fail = await complete(api, cart.id, shop.storeHeaders);
      spy.mockRestore();

      expect(fail.status).toBeGreaterThanOrEqual(400);
      expect((await balance()).consumido).toBe(0);
      expect(await shop.service.listBenefitMovements({})).toHaveLength(0);

      const retry = await complete(api, cart.id, shop.storeHeaders);
      expect(retry.status).toBe(200);
      expect(retry.data.type).toBe("order");
      expect((await balance()).consumido).toBe(20000);
    });

    it("8. un override menor a lo consumido deja el disponible en 0 y bloquea la compra siguiente", async () => {
      const cart = await readyCart(api, shop, [
        { variant_id: shop.litro, quantity: 3 },
      ]);
      expect((await complete(api, cart.id, shop.storeHeaders)).status).toBe(200);

      const res = await api.post(
        `/admin/benefit-budget/customers/${shop.customerId}/override`,
        { tope_override: 20000 },
        adminHeaders
      );
      expect(res.data.benefit_budget).toEqual(
        expect.objectContaining({ tope: 20000, consumido: 30000, disponible: 0 })
      );
      expect(await balance()).toEqual(
        expect.objectContaining({ tope: 20000, disponible: 0 })
      );

      const next = await readyCart(api, shop, [
        { variant_id: shop.chica, quantity: 1 },
      ]);
      const fail = await complete(api, next.id, shop.storeHeaders);
      expect(fail.status).toBe(400);
      expect(fail.data.message).toContain("tu disponible es $0");

      // Quitar el override vuelve al tope de la campaña
      await api.post(
        `/admin/benefit-budget/customers/${shop.customerId}/override`,
        { tope_override: null },
        adminHeaders
      );
      expect(await balance()).toEqual(
        expect.objectContaining({ tope: TOPE, disponible: TOPE - 30000 })
      );
      expect((await complete(api, next.id, shop.storeHeaders)).status).toBe(200);
    });

    it("el stock del site no cambia si el cupo bloquea la compra", async () => {
      const cart = await readyCart(api, shop, [
        { variant_id: shop.litro, quantity: 6 },
      ]);

      const fail = await complete(api, cart.id, shop.storeHeaders);
      expect(fail.status).toBe(400);
      expect(fail.data.message).toContain("Saldo de beneficio insuficiente");

      const reservations = await shop.container
        .resolve(Modules.INVENTORY)
        .listReservationItems({ location_id: shop.site.id });
      expect(reservations).toHaveLength(0);

      const { data: levels } = await shop.container.resolve("query").graph({
        entity: "inventory_level",
        fields: ["stocked_quantity", "reserved_quantity"],
        filters: { location_id: shop.site.id },
      });
      expect(
        levels.every(
          (l: any) => l.stocked_quantity === STOCK && l.reserved_quantity === 0
        )
      ).toBe(true);
    });
  },
});
