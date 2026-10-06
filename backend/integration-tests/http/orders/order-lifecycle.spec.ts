import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { adminHeaders } from "../../utils/admin";
import {
  complete,
  createOtherCustomer,
  readyCart,
  reservationsOf,
  setupShop,
  Shop,
  sleep,
  storeBalance,
  waitFor,
} from "../../utils/shop";

jest.setTimeout(120 * 1000);

/*

Ciclo del pedido (npm run test:integration:http):

- Creación: el pedido aparece en "Mis pedidos", con detalle, y el consumo
  de beneficio queda asociado a su order_id.
- "Mis pedidos" con filtro de fechas (middleware de /store/orders).
- Aislamiento entre colaboradores.
- Anulación desde el Admin: reintegra el saldo y libera el stock del site.
- Pedido ya entregado: no se puede anular y el saldo no se toca.

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

    /** Compra 2 × $10.000 y devuelve el pedido. */
    const placeOrder = async (headers = shop.storeHeaders) => {
      const cart = await readyCart(
        api,
        shop,
        [{ variant_id: shop.litro, quantity: 2 }],
        { headers }
      );
      const res = await complete(api, cart.id, headers);
      expect(res.status).toBe(200);
      return res.data.order;
    };

    const myOrders = async (params = "", headers = shop.storeHeaders) =>
      api
        .get(`/store/orders${params}`, headers)
        .catch((e: any) => e.response);

    /** Fija created_at del pedido (para probar filtros por fecha). */
    const setCreatedAt = async (orderId: string, iso: string) => {
      const pg = shop.container.resolve(ContainerRegistrationKeys.PG_CONNECTION);
      await pg.raw(`UPDATE "order" SET created_at = ? WHERE id = ?`, [
        iso,
        orderId,
      ]);
    };

    describe("creación", () => {
      it("el pedido aparece en Mis pedidos, con detalle, y el consumo queda asociado", async () => {
        const order = await placeOrder();

        const list = await myOrders();
        expect(list.status).toBe(200);
        expect(list.data.orders.map((o: any) => o.id)).toEqual([order.id]);

        const detail = await api.get(
          `/store/orders/${order.id}`,
          shop.storeHeaders
        );
        expect(detail.data.order).toEqual(
          expect.objectContaining({
            id: order.id,
            total: 20000,
            status: "pending",
            email: "test@email.com",
          })
        );
        expect(detail.data.order.items).toHaveLength(1);

        await waitFor(async () => {
          const [m] = await shop.service.listBenefitMovements({
            tipo: "consumo",
          });
          return m?.order_id === order.id;
        });
      });

      it("reserva el stock en el site elegido", async () => {
        const order = await placeOrder();

        const reservations = await reservationsOf(shop, order);
        expect(reservations).toHaveLength(1);
        expect(reservations[0]).toEqual(
          expect.objectContaining({ location_id: shop.site.id, quantity: 2 })
        );
      });
    });

    describe("Mis pedidos: filtro por fecha", () => {
      it("filtra por created_at[$gte] y created_at[$lte]", async () => {
        const viejo = await placeOrder();
        const nuevo = await placeOrder();
        await setCreatedAt(viejo.id, "2026-09-10T15:00:00Z");
        await setCreatedAt(nuevo.id, "2026-10-02T15:00:00Z");

        const desde = await myOrders("?created_at[$gte]=2026-10-01");
        expect(desde.data.orders.map((o: any) => o.id)).toEqual([nuevo.id]);

        const hasta = await myOrders("?created_at[$lte]=2026-09-30");
        expect(hasta.data.orders.map((o: any) => o.id)).toEqual([viejo.id]);
      });

      it("una fecha sola en $lte incluye todo ese día", async () => {
        const order = await placeOrder();
        await setCreatedAt(order.id, "2026-10-02T15:00:00Z");

        const res = await myOrders(
          "?created_at[$gte]=2026-10-02&created_at[$lte]=2026-10-02"
        );
        expect(res.data.orders.map((o: any) => o.id)).toEqual([order.id]);
      });

      // Las fechas del filtro son días de calendario en Chile (las elige el
      // colaborador en "Mis pedidos"), igual que el periodo del beneficio.
      it("los días del filtro son días de Santiago, no de UTC", async () => {
        const nocheDel6 = await placeOrder(); // 6-oct 22:30 en Santiago
        const nocheDel5 = await placeOrder(); // 5-oct 23:00 en Santiago
        await setCreatedAt(nocheDel6.id, "2026-10-07T01:30:00Z");
        await setCreatedAt(nocheDel5.id, "2026-10-06T02:00:00Z");

        const res = await myOrders(
          "?created_at[$gte]=2026-10-06&created_at[$lte]=2026-10-06"
        );
        expect(res.data.orders.map((o: any) => o.id)).toEqual([nocheDel6.id]);
      });

      it("rechaza fechas inválidas o un created_at sin $gte/$lte", async () => {
        await placeOrder();

        const invalida = await myOrders("?created_at[$gte]=no-es-fecha");
        expect(invalida.status).toBe(400);
        expect(invalida.data.message).toContain("Fecha inválida");

        const plano = await myOrders("?created_at=2026-10-01");
        expect(plano.status).toBe(400);
      });
    });

    describe("aislamiento entre colaboradores", () => {
      it("otro colaborador no ve mis pedidos ni su detalle", async () => {
        const order = await placeOrder();
        const otro = await createOtherCustomer(api, shop);

        const list = await myOrders("", otro.headers);
        expect(list.status).toBe(200);
        expect(list.data.orders).toEqual([]);

        const detail = await api
          .get(`/store/orders/${order.id}`, otro.headers)
          .catch((e: any) => e.response);
        expect(detail.status).toBe(404);
      });

      // El detalle trae nombre, correo e ítems del colaborador: no debe
      // poder leerse solo con el id del pedido.
      it("sin sesión no se puede ver el detalle de un pedido", async () => {
        const order = await placeOrder();
        const { Authorization, ...headers } = shop.storeHeaders.headers;

        const res = await api
          .get(`/store/orders/${order.id}`, { headers })
          .catch((e: any) => e.response);
        expect([401, 404]).toContain(res.status);
      });

      it("el cupo de un colaborador no afecta al de otro", async () => {
        await placeOrder();
        const otro = await createOtherCustomer(api, shop);

        expect((await balance()).consumido).toBe(20000);
        expect(await storeBalance(api, otro.headers)).toEqual(
          expect.objectContaining({ consumido: 0, disponible: 50000 })
        );
      });

      it("sin sesión no se pueden listar pedidos", async () => {
        const { Authorization, ...headers } = shop.storeHeaders.headers;
        const res = await myOrders("", { headers });
        expect(res.status).toBe(401);
      });
    });

    describe("administración", () => {
      it("anular desde el Admin reintegra el saldo y libera el stock del site", async () => {
        const order = await placeOrder();
        expect(await reservationsOf(shop, order)).toHaveLength(1);

        const res = await api.post(
          `/admin/orders/${order.id}/cancel`,
          {},
          adminHeaders
        );
        expect(res.status).toBe(200);
        expect(res.data.order.status).toBe("canceled");

        await waitFor(async () => (await balance()).consumido === 0);
        expect(await reservationsOf(shop, order)).toHaveLength(0);

        const detail = await api.get(
          `/store/orders/${order.id}`,
          shop.storeHeaders
        );
        expect(detail.data.order.status).toBe("canceled");
      });

      it("un pedido entregado no se puede anular y no reintegra el saldo", async () => {
        const order = await placeOrder();

        await api.post(
          `/admin/orders/${order.id}/fulfillments`,
          {
            location_id: shop.site.id,
            items: order.items.map((i: any) => ({
              id: i.id,
              quantity: i.quantity,
            })),
          },
          adminHeaders
        );
        const {
          data: {
            order: { fulfillments },
          },
        } = await api.get(
          `/admin/orders/${order.id}?fields=*fulfillments`,
          adminHeaders
        );
        const fulfillment = fulfillments[0];

        const delivered = await api.post(
          `/admin/orders/${order.id}/fulfillments/${fulfillment.id}/mark-as-delivered`,
          {},
          adminHeaders
        );
        expect(delivered.status).toBe(200);

        const cancel = await api
          .post(`/admin/orders/${order.id}/cancel`, {}, adminHeaders)
          .catch((e: any) => e.response);
        expect(cancel.status).toBe(400);

        await sleep(1000); // margen para un subscriber que no debería correr
        expect((await balance()).consumido).toBe(20000);
        expect(
          await shop.service.listBenefitMovements({ tipo: "reintegro" })
        ).toHaveLength(0);
      });
    });
  },
});
