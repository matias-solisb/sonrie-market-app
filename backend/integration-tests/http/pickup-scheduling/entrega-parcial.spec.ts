import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { PICKUP_SCHEDULING_MODULE } from "../../../src/modules/pickup-scheduling";
import PickupSchedulingModuleService from "../../../src/modules/pickup-scheduling/service";
import { MENSAJE_ENTREGA_PARCIAL } from "../../../src/workflows/pickup-scheduling/steps/deliver-fulfillments";
import { adminHeaders } from "../../utils/admin";
import { complete, readyCart, setupShop, Shop, waitFor } from "../../utils/shop";

jest.setTimeout(120 * 1000);

/*

Entrega parcial (riesgo R1 del manual, punto 3.3): un pedido con dos
cumplimientos por entregar, y la entrega del segundo falla después de
entregar el primero. Medusa no permite deshacer una entrega, así que:

- el operador ve un mensaje que dice qué pasó y qué hacer,
- el cupo sigue `agendado` (no queda "entregado" a medias) y no se deshace
  nada en Medusa (deshacer el cumplimiento creado después de una entrega
  deja las cantidades del pedido inconsistentes: se probó),
- un segundo "Entregar" entrega lo pendiente y termina.

La falla se simula envolviendo el workflow nativo de Medusa
`markOrderFulfillmentAsDeliveredWorkflow`: falla en la llamada N si
`globalThis.__pickupFallarEntregaEn = N`. Archivo propio para que el mock
no afecte otras pruebas.

*/
jest.mock("@medusajs/medusa/core-flows", () => {
  const actual = jest.requireActual("@medusajs/medusa/core-flows");

  return {
    ...actual,
    markOrderFulfillmentAsDeliveredWorkflow: (container: any) => {
      const workflow = actual.markOrderFulfillmentAsDeliveredWorkflow(container);
      const run = workflow.run.bind(workflow);
      workflow.run = async (args: any) => {
        const g = globalThis as any;
        g.__pickupEntregas = (g.__pickupEntregas ?? 0) + 1;
        if (g.__pickupFallarEntregaEn === g.__pickupEntregas) {
          throw new Error("Falla simulada al entregar el cumplimiento");
        }
        return run(args);
      };
      return workflow;
    },
  };
});

medusaIntegrationTestRunner({
  inApp: true,
  env: { JWT_SECRET: "supersecret" },
  testSuite: ({ api, getContainer }) => {
    let shop: Shop;
    let pickup: PickupSchedulingModuleService;
    const g = globalThis as any;

    beforeEach(async () => {
      shop = await setupShop({ api, getContainer });
      pickup = shop.container.resolve(PICKUP_SCHEDULING_MODULE);
      g.__pickupEntregas = 0;
      g.__pickupFallarEntregaEn = undefined;
    });

    const entregar = (orderId: string) =>
      api
        .post(`/admin/pickup-scheduling/retiros/${orderId}/entregar`, {}, adminHeaders)
        .catch((e: any) => e.response);

    const cumplimientos = async (orderId: string) =>
      (
        await api.get(
          `/admin/orders/${orderId}?fields=fulfillment_status,*fulfillments`,
          adminHeaders
        )
      ).data.order;

    it("si falla la segunda entrega: mensaje claro, cupo agendado y un segundo clic termina", async () => {
      // Pedido de 2 unidades; el admin ya había cumplido 1 con "Cumplir artículos"
      const cart = await readyCart(api, shop, [{ variant_id: shop.litro, quantity: 2 }]);
      const { order } = (await complete(api, cart.id, shop.storeHeaders)).data;
      const [booking] = await pickup.listPickupBookings({ cart_id: cart.id });
      await waitFor(async () => (await pickup.retrievePickupBooking(booking.id)).estado === "agendado");
      await api.post(
        `/admin/orders/${order.id}/fulfillments`,
        { items: [{ id: order.items[0].id, quantity: 1 }], location_id: shop.site.id },
        adminHeaders
      );

      // "Entregar": entrega el cumplimiento existente (1.ª) y falla el nuevo (2.ª)
      g.__pickupEntregas = 0;
      g.__pickupFallarEntregaEn = 2;
      const fallida = await entregar(order.id);

      expect(fallida.status).toBe(500);
      expect(fallida.data.message).toBe(MENSAJE_ENTREGA_PARCIAL);
      expect(await pickup.retrievePickupBooking(booking.id)).toMatchObject({
        estado: "agendado",
        retirado_at: null,
        retirado_por: null,
      });
      // No se deshace nada: el primero quedó entregado y el nuevo, creado y
      // pendiente (deshacerlo dejaría las cantidades de Medusa inconsistentes).
      const parcial = await cumplimientos(order.id);
      const activos = parcial.fulfillments.filter((f: any) => !f.canceled_at);
      expect(activos).toHaveLength(2);
      expect(activos.filter((f: any) => f.delivered_at)).toHaveLength(1);

      // Segundo "Entregar": entrega lo pendiente y termina
      g.__pickupFallarEntregaEn = undefined;
      const ok = await entregar(order.id);

      expect(ok.status).toBe(200);
      expect(ok.data.entregado_ahora).toBe(true);
      expect(ok.data.retiro).toMatchObject({ estado: "retirado", total_unidades: 2 });
      const final = await cumplimientos(order.id);
      expect(final.fulfillment_status).toBe("delivered");
      const entregados = final.fulfillments.filter((f: any) => !f.canceled_at);
      expect(entregados).toHaveLength(2);
      expect(entregados.every((f: any) => f.delivered_at)).toBe(true);
    });

    it("si falla la única entrega, el error es el de Medusa, no se entrega nada y se puede reintentar", async () => {
      const cart = await readyCart(api, shop, [{ variant_id: shop.litro, quantity: 1 }]);
      const { order } = (await complete(api, cart.id, shop.storeHeaders)).data;
      const [booking] = await pickup.listPickupBookings({ cart_id: cart.id });
      await waitFor(async () => (await pickup.retrievePickupBooking(booking.id)).estado === "agendado");

      g.__pickupEntregas = 0;
      g.__pickupFallarEntregaEn = 1;
      const fallida = await entregar(order.id);

      expect(fallida.status).toBeGreaterThanOrEqual(400);
      expect(fallida.data.message).not.toBe(MENSAJE_ENTREGA_PARCIAL);
      expect((await pickup.retrievePickupBooking(booking.id)).estado).toBe("agendado");
      const { fulfillments } = await cumplimientos(order.id);
      expect(fulfillments.filter((f: any) => !f.canceled_at)).toHaveLength(0);

      g.__pickupFallarEntregaEn = undefined;
      const ok = await entregar(order.id);
      expect(ok.status).toBe(200);
    });
  },
});
