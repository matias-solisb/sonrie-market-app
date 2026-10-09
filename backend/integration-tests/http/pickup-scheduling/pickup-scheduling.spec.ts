import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { Modules } from "@medusajs/framework/utils";
import { PICKUP_SCHEDULING_MODULE } from "../../../src/modules/pickup-scheduling";
import PickupSchedulingModuleService from "../../../src/modules/pickup-scheduling/service";
import { releasePickupBookingWorkflow } from "../../../src/workflows/pickup-scheduling/workflows";
import { adminHeaders } from "../../utils/admin";
import {
  createPickupSite,
  getPickupSlots,
  setPickupDate,
} from "../../utils/pickup";
import {
  complete,
  createOtherCustomer,
  readyCart,
  setupShop,
  Shop,
  storeBalance,
  waitFor,
} from "../../utils/shop";

jest.setTimeout(120 * 1000);

/*

Fecha de retiro contra la API (npm run test:integration:http):
- GET /store/pickup-slots: sesión, site, rango y cupos libres;
- POST /store/carts/:id/pickup-date: guarda la fecha y valida carrito,
  site, día y cupo, sin reservar;
- cambiar de site borra la fecha;
- el checkout exige fecha y toma el cupo (también en pedidos de $0);
- concurrencia por el último cupo;
- compensaciones: beneficio insuficiente y falla después del hook;
- ciclo del pedido: order.placed confirma el cupo y order.canceled lo
  libera (junto con el reintegro del beneficio).

setupShop deja la agenda abierta todos los días con capacidad 1000; cada
test ajusta la capacidad del site si la necesita. Los tests usan la hora
real: las fechas se toman de GET /store/pickup-slots, no se fijan a mano.

*/
medusaIntegrationTestRunner({
  inApp: true,
  env: { JWT_SECRET: "supersecret" },
  testSuite: ({ api, getContainer }) => {
    let shop: Shop;
    let pickup: PickupSchedulingModuleService;

    beforeEach(async () => {
      shop = await setupShop({ api, getContainer });
      pickup = shop.container.resolve(PICKUP_SCHEDULING_MODULE);
    });

    const slots = async (siteId = shop.site.id) =>
      (await getPickupSlots(api, siteId, shop.storeHeaders)).data;

    const fechasDisponibles = async () =>
      (await slots()).fechas
        .filter((f: any) => f.disponible)
        .map((f: any) => f.fecha as string);

    const capacidadDelSite = (capacidad_diaria: number) =>
      pickup.upsertSiteSlotConfig({
        stock_location_id: shop.site.id,
        capacidad_diaria,
      });

    const ocupados = async (fecha: string) => {
      const [row] = await pickup.listPickupOccupancies({
        stock_location_id: shop.site.id,
        fecha,
      });
      return row?.ocupados ?? 0;
    };

    /** Carrito con site pero sin fecha. */
    const cartWithoutDate = (quantity = 1) =>
      readyCart(api, shop, [{ variant_id: shop.litro, quantity }], {
        pickupDate: false,
      });

    describe("GET /store/pickup-slots", () => {
      it("exige sesión", async () => {
        const { Authorization, ...headers } = shop.storeHeaders.headers;
        const res = await getPickupSlots(api, shop.site.id, { headers });
        expect(res.status).toBe(401);
      });

      it("responde 404 si el site no existe", async () => {
        const res = await getPickupSlots(api, "sloc_no_existe", shop.storeHeaders);
        expect(res.status).toBe(404);
      });

      it("responde 400 sin site", async () => {
        const res = await api
          .get("/store/pickup-slots", shop.storeHeaders)
          .catch((e: any) => e.response);
        expect(res.status).toBe(400);
      });

      it("lista el rango elegible con sus cupos libres", async () => {
        const data = await slots();

        // Defaults: lead-time 1, horizonte 14 → 14 fechas.
        expect(data.stock_location_id).toBe(shop.site.id);
        expect(data.fechas).toHaveLength(14);
        expect(data.desde).toBe(data.fechas[0].fecha);
        expect(data.hasta).toBe(data.fechas[13].fecha);
        expect(data.fechas[0]).toEqual({
          fecha: data.desde,
          disponible: true,
          cupos: 1000,
          motivo: null,
        });
        expect(data.fechas[0]).not.toHaveProperty("capacidad");
      });

      it("muestra los días cerrados con su motivo", async () => {
        const [, segunda] = await fechasDisponibles();
        await pickup.createException({
          fecha: segunda,
          stock_location_id: shop.site.id,
          tipo: "cerrado",
          motivo: "Inventario",
        });

        const dia = (await slots()).fechas.find((f: any) => f.fecha === segunda);
        expect(dia).toEqual({
          fecha: segunda,
          disponible: false,
          cupos: 0,
          motivo: "Inventario",
        });
      });
    });

    describe("POST /store/carts/:id/pickup-date", () => {
      it("guarda la fecha en el carrito sin tomar el cupo", async () => {
        const cart = await cartWithoutDate();
        const [fecha] = await fechasDisponibles();

        const res = await setPickupDate(api, cart.id, fecha, shop.storeHeaders);

        expect(res.status).toBe(200);
        expect(res.data.cart.metadata).toEqual(
          expect.objectContaining({
            pickup_date: fecha,
            stock_location_id: shop.site.id,
          })
        );
        expect(res.data.pickup_date).toEqual({
          stock_location_id: shop.site.id,
          fecha,
        });
        expect(await ocupados(fecha)).toBe(0);
        expect(await pickup.listPickupBookings({})).toHaveLength(0);
      });

      it("rechaza el carrito de otro colaborador sin revelar que existe", async () => {
        const cart = await cartWithoutDate();
        const [fecha] = await fechasDisponibles();
        const otro = await createOtherCustomer(api, shop);

        const res = await setPickupDate(api, cart.id, fecha, otro.headers);
        expect(res.status).toBe(404);
      });

      it("exige elegir antes el site", async () => {
        const cart = (
          await api.post(
            "/store/carts",
            {
              region_id: shop.region.id,
              items: [{ variant_id: shop.litro, quantity: 1 }],
            },
            shop.storeHeaders
          )
        ).data.cart;
        const [fecha] = await fechasDisponibles();

        const res = await setPickupDate(api, cart.id, fecha, shop.storeHeaders);
        expect(res.status).toBe(400);
        expect(res.data.message).toBe("Elige primero el site de retiro.");
      });

      it("rechaza formato inválido, fechas fuera de rango y días cerrados", async () => {
        const cart = await cartWithoutDate();
        const data = await slots();
        const [, segunda] = data.fechas.map((f: any) => f.fecha);

        const formato = await setPickupDate(api, cart.id, "12-10-2026", shop.storeHeaders);
        expect(formato.status).toBe(400);

        const despues = new Date(`${data.hasta}T12:00:00Z`);
        despues.setUTCDate(despues.getUTCDate() + 1);
        const fuera = await setPickupDate(
          api,
          cart.id,
          despues.toISOString().slice(0, 10),
          shop.storeHeaders
        );
        expect(fuera.status).toBe(400);
        expect(fuera.data.message).toContain("La fecha de retiro debe ser hasta el");

        await pickup.createException({
          fecha: segunda,
          stock_location_id: shop.site.id,
          tipo: "cerrado",
          motivo: "Inventario",
        });
        const cerrado = await setPickupDate(api, cart.id, segunda, shop.storeHeaders);
        expect(cerrado.status).toBe(400);
        expect(cerrado.data.message).toContain("(Inventario)");
      });

      it("rechaza un día sin cupos", async () => {
        await capacidadDelSite(1);
        const [fecha] = await fechasDisponibles();

        const first = await readyCart(api, shop, [{ variant_id: shop.litro, quantity: 1 }]);
        expect((await complete(api, first.id, shop.storeHeaders)).status).toBe(200);

        const cart = await cartWithoutDate();
        const res = await setPickupDate(api, cart.id, fecha, shop.storeHeaders);
        expect(res.status).toBe(400);
        expect(res.data.message).toContain("No quedan cupos de retiro");
      });

      it("cambiar de site borra la fecha; volver a elegir el mismo site la conserva", async () => {
        const cart = await cartWithoutDate();
        const [fecha] = await fechasDisponibles();
        await setPickupDate(api, cart.id, fecha, shop.storeHeaders);

        const mismo = await api.post(
          `/store/carts/${cart.id}/pickup-site`,
          { stock_location_id: shop.site.id },
          shop.storeHeaders
        );
        expect(mismo.data.cart.metadata.pickup_date).toBe(fecha);

        const sur = await createPickupSite(shop.container, {
          name: "Sala Sur",
          catalogSalesChannelId: shop.catalogId,
        });
        const otro = await api.post(
          `/store/carts/${cart.id}/pickup-site`,
          { stock_location_id: sur.id },
          shop.storeHeaders
        );
        expect(otro.data.cart.metadata.stock_location_id).toBe(sur.id);
        expect(otro.data.cart.metadata).not.toHaveProperty("pickup_date");
      });
    });

    describe("checkout", () => {
      it("sin fecha no se puede completar", async () => {
        const cart = await cartWithoutDate();

        const res = await complete(api, cart.id, shop.storeHeaders);
        expect(res.status).toBe(400);
        expect(res.data.message).toBe(
          "Elige una fecha de retiro antes de confirmar el pedido."
        );
        expect((await storeBalance(api, shop.storeHeaders)).consumido).toBe(0);
      });

      it("con fecha toma el cupo del día y la fecha queda en el pedido", async () => {
        const cart = await readyCart(api, shop, [{ variant_id: shop.litro, quantity: 1 }]);
        const fecha = (
          await api.get(`/store/carts/${cart.id}`, shop.storeHeaders)
        ).data.cart.metadata.pickup_date;

        const res = await complete(api, cart.id, shop.storeHeaders);
        expect(res.status).toBe(200);

        // completeCart copia la metadata del carrito al pedido (la respuesta
        // del endpoint no la incluye, por eso se lee con query).
        const {
          data: [order],
        } = await shop.container.resolve("query").graph({
          entity: "order",
          fields: ["metadata"],
          filters: { id: res.data.order.id },
        });
        expect(order.metadata).toEqual(
          expect.objectContaining({
            pickup_date: fecha,
            stock_location_id: shop.site.id,
          })
        );

        expect(await ocupados(fecha)).toBe(1);
        const [booking] = await pickup.listPickupBookings({ cart_id: cart.id });
        expect(booking).toMatchObject({
          stock_location_id: shop.site.id,
          fecha,
          bloque: null,
        });

        const dia = (await slots()).fechas.find((f: any) => f.fecha === fecha);
        expect(dia.cupos).toBe(999);
      });

      it("un pedido de $0 también ocupa un cupo", async () => {
        await api.post(
          "/admin/promotions",
          {
            code: "GRATIS",
            type: "standard",
            status: "active",
            is_automatic: false,
            application_method: {
              target_type: "items",
              allocation: "across",
              currency_code: "clp",
              type: "percentage",
              value: 100,
            },
          },
          adminHeaders
        );
        const cart = await readyCart(
          api,
          shop,
          [{ variant_id: shop.litro, quantity: 1 }],
          { pay: false }
        );
        await api.post(
          `/store/carts/${cart.id}/promotions`,
          { promo_codes: ["GRATIS"] },
          shop.storeHeaders
        );
        const { payment_collection } = (
          await api.post("/store/payment-collections", { cart_id: cart.id }, shop.storeHeaders)
        ).data;
        await api.post(
          `/store/payment-collections/${payment_collection.id}/payment-sessions`,
          { provider_id: "pp_system_default" },
          shop.storeHeaders
        );

        const res = await complete(api, cart.id, shop.storeHeaders);
        expect(res.status).toBe(200);
        expect(res.data.order.total).toBe(0);
        expect(await pickup.listPickupBookings({ cart_id: cart.id })).toHaveLength(1);
      });

      it("dos checkouts simultáneos por el último cupo: un solo pedido", async () => {
        await capacidadDelSite(1);
        const a = await readyCart(api, shop, [{ variant_id: shop.litro, quantity: 1 }]);
        const b = await readyCart(api, shop, [{ variant_id: shop.chica, quantity: 1 }]);

        const results = await Promise.all([
          complete(api, a.id, shop.storeHeaders),
          complete(api, b.id, shop.storeHeaders),
        ]);

        expect(results.filter((r) => r.status === 200)).toHaveLength(1);
        const fail = results.find((r) => r.status !== 200);
        expect(fail.data.message).toContain("No quedan cupos de retiro");
        expect(await pickup.listPickupBookings({})).toHaveLength(1);
      });

      it("si el día se llenó al confirmar, rechaza y no descuenta beneficio", async () => {
        await capacidadDelSite(1);
        const a = await readyCart(api, shop, [{ variant_id: shop.litro, quantity: 1 }]);
        const b = await readyCart(api, shop, [{ variant_id: shop.litro, quantity: 2 }]);

        expect((await complete(api, a.id, shop.storeHeaders)).status).toBe(200);
        const res = await complete(api, b.id, shop.storeHeaders);

        expect(res.status).toBe(400);
        expect(res.data.message).toContain("No quedan cupos de retiro");
        expect((await storeBalance(api, shop.storeHeaders)).consumido).toBe(10000);
      });

      it("si el beneficio no alcanza, el cupo de retiro se devuelve", async () => {
        // 6 × $10.000 = $60.000 > tope $50.000
        const cart = await readyCart(api, shop, [{ variant_id: shop.litro, quantity: 6 }]);
        const fecha = (
          await api.get(`/store/carts/${cart.id}`, shop.storeHeaders)
        ).data.cart.metadata.pickup_date;

        const res = await complete(api, cart.id, shop.storeHeaders);

        expect(res.status).toBe(400);
        expect(res.data.message).toContain("Saldo de beneficio insuficiente");
        expect(await ocupados(fecha)).toBe(0);
        expect(await pickup.listPickupBookings({ cart_id: cart.id })).toHaveLength(0);
      });

      it("si el checkout falla después del hook, devuelve cupo y beneficio y se puede reintentar", async () => {
        const cart = await readyCart(api, shop, [{ variant_id: shop.litro, quantity: 2 }]);
        const fecha = (
          await api.get(`/store/carts/${cart.id}`, shop.storeHeaders)
        ).data.cart.metadata.pickup_date;

        // La reserva de stock corre DESPUÉS del hook que toma los cupos.
        const inventory = shop.container.resolve(Modules.INVENTORY);
        const spy = jest
          .spyOn(inventory, "createReservationItems")
          .mockRejectedValueOnce(new Error("Falla simulada al reservar stock"));

        const fail = await complete(api, cart.id, shop.storeHeaders);
        spy.mockRestore();

        expect(fail.status).toBeGreaterThanOrEqual(400);
        expect(await ocupados(fecha)).toBe(0);
        expect(await pickup.listPickupBookings({ cart_id: cart.id })).toHaveLength(0);
        expect((await storeBalance(api, shop.storeHeaders)).consumido).toBe(0);

        const retry = await complete(api, cart.id, shop.storeHeaders);
        expect(retry.status).toBe(200);
        expect(await ocupados(fecha)).toBe(1);
        expect((await storeBalance(api, shop.storeHeaders)).consumido).toBe(20000);
      });
    });

    describe("ciclo del pedido", () => {
      const comprar = async (quantity = 1) => {
        const cart = await readyCart(api, shop, [{ variant_id: shop.litro, quantity }]);
        const res = await complete(api, cart.id, shop.storeHeaders);
        expect(res.status).toBe(200);
        const [booking] = await pickup.listPickupBookings({ cart_id: cart.id });
        return { cart, order: res.data.order, booking };
      };

      const booking = async (id: string) => await pickup.retrievePickupBooking(id);

      const anular = (orderId: string) =>
        api.post(`/admin/orders/${orderId}/cancel`, {}, adminHeaders);

      it("al crearse el pedido el cupo queda confirmado y asociado", async () => {
        const { order, booking: b } = await comprar();

        await waitFor(async () => (await booking(b.id)).estado === "confirmado");
        expect(await booking(b.id)).toMatchObject({
          order_id: order.id,
          estado: "confirmado",
        });

        // Link de solo lectura pickup_booking -> order
        const {
          data: [withOrder],
        } = await shop.container.resolve("query").graph({
          entity: "pickup_booking",
          fields: ["id", "order.id"],
          filters: { id: b.id },
        });
        expect((withOrder as any).order.id).toBe(order.id);
      });

      it("al anular el pedido se libera el cupo y se reintegra el beneficio", async () => {
        const { order, booking: b } = await comprar(2);
        await waitFor(async () => (await booking(b.id)).estado === "confirmado");
        expect(await ocupados(b.fecha)).toBe(1);

        await anular(order.id);

        await waitFor(async () => (await booking(b.id)).estado === "liberado");
        expect(await ocupados(b.fecha)).toBe(0);
        await waitFor(
          async () => (await storeBalance(api, shop.storeHeaders)).consumido === 0
        );

        const dia = (await slots()).fechas.find((f: any) => f.fecha === b.fecha);
        expect(dia.cupos).toBe(1000);
      });

      it("con el día lleno, anular un pedido deja comprar a otro colaborador", async () => {
        await capacidadDelSite(1);
        const { order, booking: b } = await comprar();

        const otro = await createOtherCustomer(api, shop);
        const cart = await readyCart(
          api,
          shop,
          [{ variant_id: shop.chica, quantity: 1 }],
          { headers: otro.headers, pickupDate: false }
        );
        const lleno = await setPickupDate(api, cart.id, b.fecha, otro.headers);
        expect(lleno.status).toBe(400);
        expect(lleno.data.message).toContain("No quedan cupos de retiro");

        await waitFor(async () => (await booking(b.id)).estado === "confirmado");
        await anular(order.id);
        await waitFor(async () => (await booking(b.id)).estado === "liberado");

        expect((await setPickupDate(api, cart.id, b.fecha, otro.headers)).status).toBe(200);
        expect((await complete(api, cart.id, otro.headers)).status).toBe(200);
        expect(await ocupados(b.fecha)).toBe(1);
      });

      it("liberar dos veces el mismo pedido devuelve el cupo una sola vez", async () => {
        const { order, cart, booking: b } = await comprar();
        await waitFor(async () => (await booking(b.id)).estado === "confirmado");

        const first = await releasePickupBookingWorkflow(shop.container).run({
          input: { order_id: order.id, cart_id: cart.id },
        });
        const second = await releasePickupBookingWorkflow(shop.container).run({
          input: { order_id: order.id, cart_id: cart.id },
        });

        expect(first.result).toMatchObject({
          booking_id: b.id,
          estado_anterior: "confirmado",
          released: true,
        });
        expect(second.result).toMatchObject({ released: false });
        expect(await ocupados(b.fecha)).toBe(0);
      });

      it("libera por carrito si el pedido aún no estaba asociado al cupo", async () => {
        const { order, cart, booking: b } = await comprar();
        await waitFor(async () => (await booking(b.id)).estado === "confirmado");
        // Simula que order.placed no alcanzó a correr.
        await pickup.updatePickupBookings({ id: b.id, order_id: null, estado: "reservado" });

        const { result } = await releasePickupBookingWorkflow(shop.container).run({
          input: { order_id: order.id, cart_id: cart.id },
        });

        expect(result).toMatchObject({ booking_id: b.id, released: true });
        expect(await ocupados(b.fecha)).toBe(0);
      });
    });

    /*
    Errores y correcciones del colaborador: la fecha guardada en el carrito
    deja de servir entre que la eligió y que confirma (el carrito quedó de
    un día para otro, o el Admin cerró el día), o se intenta saltar la
    validación escribiendo la metadata del carrito a mano. En todos los
    casos el checkout rechaza sin tomar cupo ni beneficio, y el colaborador
    puede corregir eligiendo otra fecha. Después de comprar, la única
    corrección es que el Admin anule el pedido y el colaborador vuelva a
    comprar.
    */
    describe("errores y correcciones del colaborador", () => {
      const fechaDelCarrito = async (cartId: string) =>
        (await api.get(`/store/carts/${cartId}`, shop.storeHeaders)).data.cart
          .metadata.pickup_date as string;

      /**
       * Escribe `metadata.pickup_date` con la API estándar del carrito, que
       * no pasa por la validación de POST /store/carts/:id/pickup-date.
       * Conserva el resto de la metadata (el site elegido).
       */
      const metadataAMano = async (cartId: string, pickup_date: unknown) => {
        const { metadata } = (
          await api.get(`/store/carts/${cartId}`, shop.storeHeaders)
        ).data.cart;
        const res = await api.post(
          `/store/carts/${cartId}`,
          { metadata: { ...metadata, pickup_date } },
          shop.storeHeaders
        );
        expect(res.status).toBe(200);
      };

      const sinEfectos = async (cartId: string) => {
        expect(await pickup.listPickupBookings({ cart_id: cartId })).toHaveLength(0);
        expect((await storeBalance(api, shop.storeHeaders)).consumido).toBe(0);
      };

      it("fecha vencida: la fecha guardada salió del rango, se rechaza y se corrige eligiendo otra", async () => {
        const cart = await readyCart(api, shop, [{ variant_id: shop.litro, quantity: 1 }]);
        const fecha = await fechaDelCarrito(cart.id);

        // Mismo efecto que dejar el carrito de un día para otro: la fecha
        // guardada queda antes del primer día elegible.
        await pickup.upsertSiteSlotConfig({
          stock_location_id: shop.site.id,
          lead_time_dias: 3,
        });

        const res = await complete(api, cart.id, shop.storeHeaders);
        expect(res.status).toBe(400);
        expect(res.data.message).toContain("La fecha de retiro debe ser desde el");
        await sinEfectos(cart.id);

        // El storefront ya no la ofrece
        expect((await slots()).fechas.map((f: any) => f.fecha)).not.toContain(fecha);

        const [otra] = await fechasDisponibles();
        expect((await setPickupDate(api, cart.id, otra, shop.storeHeaders)).status).toBe(200);
        expect((await complete(api, cart.id, shop.storeHeaders)).status).toBe(200);
        expect(await ocupados(otra)).toBe(1);
      });

      it("el Admin cierra el día después de que el colaborador lo eligió: se rechaza con el motivo", async () => {
        const cart = await readyCart(api, shop, [{ variant_id: shop.litro, quantity: 1 }]);
        const fecha = await fechaDelCarrito(cart.id);

        const cierre = await api.post(
          "/admin/pickup-scheduling/exceptions",
          {
            fecha,
            stock_location_id: shop.site.id,
            tipo: "cerrado",
            motivo: "Inventario",
          },
          adminHeaders
        );
        expect(cierre.status).toBe(200);

        const res = await complete(api, cart.id, shop.storeHeaders);
        expect(res.status).toBe(400);
        expect(res.data.message).toContain("El site no atiende retiros el");
        expect(res.data.message).toContain("(Inventario)");
        await sinEfectos(cart.id);

        const dia = (await slots()).fechas.find((f: any) => f.fecha === fecha);
        expect(dia).toMatchObject({ disponible: false, motivo: "Inventario" });

        const otra = (await fechasDisponibles()).find((f) => f !== fecha)!;
        expect((await setPickupDate(api, cart.id, otra, shop.storeHeaders)).status).toBe(200);
        expect((await complete(api, cart.id, shop.storeHeaders)).status).toBe(200);
      });

      it("un feriado cargado después de elegir la fecha también se respeta", async () => {
        const cart = await readyCart(api, shop, [{ variant_id: shop.litro, quantity: 1 }]);
        const fecha = await fechaDelCarrito(cart.id);

        await api.post(
          "/admin/pickup-scheduling/exceptions",
          { fecha, tipo: "feriado", motivo: "Feriado de prueba" },
          adminHeaders
        );

        const res = await complete(api, cart.id, shop.storeHeaders);
        expect(res.status).toBe(400);
        expect(res.data.message).toContain("(Feriado de prueba)");
        await sinEfectos(cart.id);
      });

      describe("saltarse la validación escribiendo la metadata del carrito", () => {
        it.each([
          ["un formato inválido", "mañana"],
          ["una fecha que no existe", "2026-02-30"],
          ["un número", 20261010],
        ])("con %s, el checkout la rechaza", async (_caso, valor) => {
          const cart = await cartWithoutDate();
          await metadataAMano(cart.id, valor);

          const res = await complete(api, cart.id, shop.storeHeaders);
          expect(res.status).toBe(400);
          expect(res.data.message).toMatch(
            /Elige una fecha de retiro válida|Elige una fecha de retiro antes de confirmar/
          );
          await sinEfectos(cart.id);
        });

        it("con hoy (antes del lead-time), el checkout la rechaza", async () => {
          const cart = await cartWithoutDate();
          const [primera] = await fechasDisponibles();
          const hoy = new Date(Date.parse(`${primera}T12:00:00Z`) - 86400000)
            .toISOString()
            .slice(0, 10);
          await metadataAMano(cart.id, hoy);

          const res = await complete(api, cart.id, shop.storeHeaders);
          expect(res.status).toBe(400);
          expect(res.data.message).toContain("La fecha de retiro debe ser desde el");
          await sinEfectos(cart.id);
        });

        it("con un día cerrado, el checkout la rechaza", async () => {
          const cart = await cartWithoutDate();
          const [fecha] = await fechasDisponibles();
          await pickup.createException({
            fecha,
            stock_location_id: shop.site.id,
            tipo: "cerrado",
            motivo: "Mantención",
          });
          await metadataAMano(cart.id, fecha);

          const res = await complete(api, cart.id, shop.storeHeaders);
          expect(res.status).toBe(400);
          expect(res.data.message).toContain("(Mantención)");
          await sinEfectos(cart.id);
        });

        it("con un día sin cupos, el checkout la rechaza", async () => {
          await capacidadDelSite(0);
          const cart = await cartWithoutDate();
          const fecha = (await slots()).fechas[0].fecha;
          await metadataAMano(cart.id, fecha);

          const res = await complete(api, cart.id, shop.storeHeaders);
          expect(res.status).toBe(400);
          expect(res.data.message).toContain("No quedan cupos de retiro");
          await sinEfectos(cart.id);
        });
      });

      it("el mismo colaborador anula y vuelve a comprar para el mismo día lleno", async () => {
        await capacidadDelSite(1);
        const primero = await readyCart(api, shop, [{ variant_id: shop.litro, quantity: 2 }]);
        const fecha = await fechaDelCarrito(primero.id);
        const res = await complete(api, primero.id, shop.storeHeaders);
        expect(res.status).toBe(200);
        const [b] = await pickup.listPickupBookings({ cart_id: primero.id });
        await waitFor(
          async () => (await pickup.retrievePickupBooking(b.id)).estado === "confirmado"
        );

        // Lleno: el mismo colaborador no puede tomar un segundo cupo ese día
        const segundo = await cartWithoutDate();
        const lleno = await setPickupDate(api, segundo.id, fecha, shop.storeHeaders);
        expect(lleno.status).toBe(400);
        expect(lleno.data.message).toContain("No quedan cupos de retiro");

        // Se equivocó: el Admin anula el primero y vuelve a comprar
        await api.post(`/admin/orders/${res.data.order.id}/cancel`, {}, adminHeaders);
        await waitFor(
          async () => (await pickup.retrievePickupBooking(b.id)).estado === "liberado"
        );
        await waitFor(
          async () => (await storeBalance(api, shop.storeHeaders)).consumido === 0
        );

        expect((await setPickupDate(api, segundo.id, fecha, shop.storeHeaders)).status).toBe(200);
        expect((await complete(api, segundo.id, shop.storeHeaders)).status).toBe(200);

        expect(await ocupados(fecha)).toBe(1);
        // Solo cuenta el pedido vigente (1 × $10.000)
        expect((await storeBalance(api, shop.storeHeaders)).consumido).toBe(10000);
        const activos = (await pickup.listPickupBookings({ fecha })).filter(
          (x: any) => x.estado !== "liberado"
        );
        expect(activos).toHaveLength(1);
      });

      it("editar un pedido en el Admin (quitar unidades) no mueve ni libera su cupo", async () => {
        const cart = await readyCart(api, shop, [{ variant_id: shop.litro, quantity: 2 }]);
        const fecha = await fechaDelCarrito(cart.id);
        const res = await complete(api, cart.id, shop.storeHeaders);
        expect(res.status).toBe(200);
        const order = res.data.order;
        const [b] = await pickup.listPickupBookings({ cart_id: cart.id });
        await waitFor(
          async () => (await pickup.retrievePickupBooking(b.id)).estado === "confirmado"
        );

        const { order_change } = (
          await api.post("/admin/order-edits", { order_id: order.id }, adminHeaders)
        ).data;
        await api.post(
          `/admin/order-edits/${order.id}/items/item/${order.items[0].id}`,
          { quantity: 1 },
          adminHeaders
        );
        await api.post(`/admin/order-edits/${order.id}/request`, {}, adminHeaders);
        const confirmado = await api.post(
          `/admin/order-edits/${order.id}/confirm`,
          {},
          adminHeaders
        );
        expect(order_change).toBeDefined();
        expect(confirmado.status).toBe(200);

        expect(await pickup.retrievePickupBooking(b.id)).toMatchObject({
          estado: "confirmado",
          order_id: order.id,
          fecha,
        });
        expect(await ocupados(fecha)).toBe(1);
      });
    });
  },
});
