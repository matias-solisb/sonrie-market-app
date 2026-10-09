import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { PICKUP_SCHEDULING_MODULE } from "../../../src/modules/pickup-scheduling";
import PickupSchedulingModuleService from "../../../src/modules/pickup-scheduling/service";
import { adminHeaders } from "../../utils/admin";
import { getPickupSlots, setPickupDate } from "../../utils/pickup";
import { complete, readyCart, setupShop, Shop, waitFor } from "../../utils/shop";

jest.setTimeout(120 * 1000);

/*

Administración de la agenda de retiro (npm run test:integration:http):
configuración general, por site, horario semanal, excepciones, carga de
feriados de Chile, ocupación, auditoría con el usuario del Admin (tabla de
solo lectura y log después del commit), cupo de un pedido y pedidos
agendados en días que se cerraron después.

setupShop deja la agenda abierta todos los días con capacidad 1000 (esa
edición no tiene usuario: queda auditada como "sistema").

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

    const BASE = "/admin/pickup-scheduling";
    const get = (path: string) =>
      api.get(`${BASE}${path}`, adminHeaders).catch((e: any) => e.response);
    const post = (path: string, body: any) =>
      api.post(`${BASE}${path}`, body, adminHeaders).catch((e: any) => e.response);
    const del = (path: string) =>
      api.delete(`${BASE}${path}`, adminHeaders).catch((e: any) => e.response);

    const firstSlot = async () =>
      (await getPickupSlots(api, shop.site.id, shop.storeHeaders)).data.fechas[0]
        .fecha as string;

    const changes = async () => (await get("/changes")).data.cambios as any[];

    it("exige usuario del Admin", async () => {
      const res = await api
        .get(`${BASE}/settings`, { headers: {} })
        .catch((e: any) => e.response);
      expect(res.status).toBe(401);
    });

    it("un colaborador logueado no puede leer ni editar la agenda", async () => {
      const lectura = await api
        .get(`${BASE}/settings`, shop.storeHeaders)
        .catch((e: any) => e.response);
      expect(lectura.status).toBe(401);

      const escritura = await api
        .post(
          `${BASE}/exceptions`,
          { fecha: await firstSlot(), tipo: "cerrado" },
          shop.storeHeaders
        )
        .catch((e: any) => e.response);
      expect(escritura.status).toBe(401);
      expect(await pickup.listSiteScheduleExceptions({})).toHaveLength(0);

      const pedidos = await api
        .get(`${BASE}/bookings?fecha=${await firstSlot()}`, shop.storeHeaders)
        .catch((e: any) => e.response);
      expect(pedidos.status).toBe(401);
    });

    describe("configuración general", () => {
      it("se lee y se edita, con auditoría del usuario", async () => {
        expect((await get("/settings")).data.settings).toMatchObject({
          capacidad_por_defecto: 1000,
          lead_time_dias: 1,
          horizonte_dias: 14,
        });

        const res = await post("/settings", {
          capacidad_por_defecto: 40,
          dias_abiertos_por_defecto: [6, 1, 2, 3, 4, 5],
        });
        expect(res.status).toBe(200);
        expect(res.data.settings).toMatchObject({
          capacidad_por_defecto: 40,
          dias_abiertos_por_defecto: [1, 2, 3, 4, 5, 6],
        });

        const [ultimo] = await changes();
        expect(ultimo).toMatchObject({
          entidad: "configuracion",
          accion: "editar",
          actor: expect.objectContaining({ email: "admin@medusa.js" }),
          cambios: {
            capacidad_por_defecto: { anterior: 1000, nuevo: 40 },
            dias_abiertos_por_defecto: {
              anterior: [1, 2, 3, 4, 5, 6, 7],
              nuevo: [1, 2, 3, 4, 5, 6],
            },
          },
        });
      });

      it("valida los datos", async () => {
        expect((await post("/settings", { lead_time_dias: -1 })).status).toBe(400);
        expect((await post("/settings", { dias_abiertos_por_defecto: [8] })).status).toBe(400);
        expect((await post("/settings", { otra_cosa: 1 })).status).toBe(400);

        const res = await post("/settings", { lead_time_dias: 10, horizonte_dias: 5 });
        expect(res.status).toBe(400);
        expect(res.data.message).toContain("horizonte no puede ser menor");
      });
    });

    describe("sites y horario semanal", () => {
      it("lista los sites con lo que heredan y edita la configuración del site", async () => {
        const list = (await get("/sites")).data;
        expect(list.settings.capacidad_por_defecto).toBe(1000);
        expect(list.sites).toEqual([
          expect.objectContaining({
            id: shop.site.id,
            name: "Sala Test",
            config: null,
            horario: [],
          }),
        ]);

        const res = await post(`/sites/${shop.site.id}`, { capacidad_diaria: 5 });
        expect(res.status).toBe(200);
        expect(res.data.config).toEqual({
          capacidad_diaria: 5,
          lead_time_dias: null,
          horizonte_dias: null,
        });

        const fecha = await firstSlot();
        const dia = (await getPickupSlots(api, shop.site.id, shop.storeHeaders)).data.fechas[0];
        expect(dia).toMatchObject({ fecha, cupos: 5 });

        const [ultimo] = await changes();
        expect(ultimo).toMatchObject({
          entidad: "site",
          accion: "crear",
          site_name: "Sala Test",
          cambios: { capacidad_diaria: { anterior: null, nuevo: 5 } },
        });
      });

      it("responde 404 con un site que no existe", async () => {
        expect((await post("/sites/sloc_no_existe", { capacidad_diaria: 5 })).status).toBe(404);
        expect(
          (await post("/sites/sloc_no_existe/horario/6", { abierto: true })).status
        ).toBe(404);
      });

      it("define y quita el horario propio de un día", async () => {
        const site = shop.site.id;

        const res = await post(`/sites/${site}/horario/6`, { abierto: true, capacidad: 3 });
        expect(res.status).toBe(200);
        expect(res.data.horario).toEqual({ dia_semana: 6, abierto: true, capacidad: 3 });

        expect((await get("/sites")).data.sites[0].horario).toEqual([
          { dia_semana: 6, abierto: true, capacidad: 3 },
        ]);

        expect((await del(`/sites/${site}/horario/6`)).status).toBe(200);
        expect((await get("/sites")).data.sites[0].horario).toEqual([]);

        expect((await post(`/sites/${site}/horario/8`, { abierto: true })).status).toBe(400);
        expect((await post(`/sites/${site}/horario/6`, {})).status).toBe(400);

        const registro = (await changes()).filter((c) => c.entidad === "horario");
        expect(registro.map((c) => c.accion)).toEqual(["eliminar", "crear"]);
      });
    });

    describe("excepciones y feriados", () => {
      it("crea, lista, edita y elimina excepciones", async () => {
        const fecha = await firstSlot();

        const created = await post("/exceptions", {
          fecha,
          stock_location_id: shop.site.id,
          tipo: "cerrado",
          motivo: "Inventario",
        });
        expect(created.status).toBe(200);
        expect(created.data.exception).toMatchObject({
          fecha,
          site_name: "Sala Test",
          tipo: "cerrado",
          motivo: "Inventario",
        });
        const id = created.data.exception.id;

        const list = (await get(`/exceptions?desde=${fecha}&hasta=${fecha}`)).data;
        expect(list.exceptions).toHaveLength(1);

        const edited = await post(`/exceptions/${id}`, { motivo: "Inventario anual" });
        expect(edited.data.exception.motivo).toBe("Inventario anual");

        expect((await del(`/exceptions/${id}`)).status).toBe(200);
        expect((await del(`/exceptions/${id}`)).status).toBe(404);
        expect(
          (await get(`/exceptions?desde=${fecha}&hasta=${fecha}`)).data.exceptions
        ).toHaveLength(0);

        const registro = (await changes()).filter((c) => c.entidad === "excepcion");
        expect(registro.map((c) => c.accion)).toEqual(["eliminar", "editar", "crear"]);
      });

      it("valida las excepciones", async () => {
        const fecha = await firstSlot();

        const irrenunciableEnSite = await post("/exceptions", {
          fecha,
          stock_location_id: shop.site.id,
          tipo: "feriado",
          irrenunciable: true,
        });
        expect(irrenunciableEnSite.status).toBe(400);
        expect(irrenunciableEnSite.data.message).toContain("irrenunciable");

        expect(
          (await post("/exceptions", { fecha, stock_location_id: "sloc_x", tipo: "cerrado" }))
            .status
        ).toBe(404);
        expect((await post("/exceptions", { fecha: "12-10-2026", tipo: "cerrado" })).status).toBe(
          400
        );

        await post("/exceptions", { fecha, tipo: "cerrado" });
        const duplicada = await post("/exceptions", { fecha, tipo: "feriado" });
        expect(duplicada.status).toBe(400);
        expect(duplicada.data.message).toContain("Ya existe una excepción global");
      });

      it("un día cerrado desde el Admin deja de ofrecerse en el storefront", async () => {
        const fecha = await firstSlot();
        await post("/exceptions", {
          fecha,
          stock_location_id: shop.site.id,
          tipo: "cerrado",
          motivo: "Inventario",
        });

        const dia = (await getPickupSlots(api, shop.site.id, shop.storeHeaders)).data.fechas.find(
          (f: any) => f.fecha === fecha
        );
        expect(dia).toEqual({ fecha, disponible: false, cupos: 0, motivo: "Inventario" });

        const cart = await readyCart(api, shop, [{ variant_id: shop.litro, quantity: 1 }], {
          pickupDate: false,
        });
        const res = await setPickupDate(api, cart.id, fecha, shop.storeHeaders);
        expect(res.status).toBe(400);
        expect(res.data.message).toContain("(Inventario)");
      });

      it("carga los feriados de Chile una vez", async () => {
        expect((await get("/feriados")).data.anios).toEqual([2026, 2027]);

        const first = await post("/feriados", { anio: 2027 });
        expect(first.status).toBe(200);
        expect(first.data.creados).toHaveLength(17);

        const second = await post("/feriados", { anio: 2027 });
        expect(second.data.creados).toHaveLength(0);
        expect(second.data.omitidos).toHaveLength(17);

        const navidad = (
          await get("/exceptions?desde=2027-12-25&hasta=2027-12-25")
        ).data.exceptions[0];
        expect(navidad).toMatchObject({
          stock_location_id: null,
          tipo: "feriado",
          irrenunciable: true,
          motivo: "Navidad",
        });

        expect((await post("/feriados", { anio: 2031 })).status).toBe(400);
        expect((await post("/feriados", { anio: "2027" })).status).toBe(400);

        const [ultimo] = await changes();
        expect(ultimo).toMatchObject({ entidad: "excepcion", referencia: "feriados-2027" });
      });
    });

    describe("ocupación", () => {
      it("muestra los cupos tomados por día", async () => {
        await post(`/sites/${shop.site.id}`, { capacidad_diaria: 3 });
        const cart = await readyCart(api, shop, [{ variant_id: shop.litro, quantity: 1 }]);
        const fecha = (await api.get(`/store/carts/${cart.id}`, shop.storeHeaders)).data.cart
          .metadata.pickup_date;
        expect((await complete(api, cart.id, shop.storeHeaders)).status).toBe(200);

        const res = await get(
          `/occupancy?stock_location_id=${shop.site.id}&desde=${fecha}&hasta=${fecha}`
        );
        expect(res.status).toBe(200);
        expect(res.data.dias).toEqual([
          expect.objectContaining({
            fecha,
            abierto: true,
            capacidad: 3,
            ocupados: 1,
            disponibles: 2,
          }),
        ]);

        // Por defecto: hoy y los 13 días siguientes.
        const def = await get(`/occupancy?stock_location_id=${shop.site.id}`);
        expect(def.data.dias).toHaveLength(14);

        expect((await get(`/occupancy`)).status).toBe(400);
        expect((await get(`/occupancy?stock_location_id=sloc_x`)).status).toBe(404);
      });
    });

    describe("auditoría", () => {
      it("guarda el correo del usuario junto al cambio", async () => {
        await post("/settings", { capacidad_por_defecto: 30 });

        const [row] = await pickup.listPickupScheduleChanges(
          { entidad: "configuracion" },
          { order: { created_at: "DESC" }, take: 1 }
        );
        expect(row.actor_id).toMatch(/^user_/);
        expect(row.actor_email).toBe("admin@medusa.js");
      });

      it("escribe un log JSON por cambio, después de guardarlo", async () => {
        const logger = shop.container.resolve("logger");
        const spy = jest.spyOn(logger, "info");

        await post("/settings", { capacidad_por_defecto: 25 });

        const logs = spy.mock.calls
          .map(([msg]) => {
            try {
              return JSON.parse(String(msg));
            } catch {
              return null;
            }
          })
          .filter((l) => l?.evento === "pickup_scheduling.cambio");
        spy.mockRestore();

        expect(logs).toHaveLength(1);
        expect(logs[0]).toMatchObject({
          entidad: "configuracion",
          accion: "editar",
          actor_email: "admin@medusa.js",
          cambios: { capacidad_por_defecto: { anterior: 1000, nuevo: 25 } },
        });
        // El log corresponde a una fila ya guardada
        expect(await pickup.retrievePickupScheduleChange(logs[0].id)).toBeDefined();
      });

      it("un cambio rechazado no deja auditoría ni log", async () => {
        const antes = (await pickup.listPickupScheduleChanges({})).length;
        const logger = shop.container.resolve("logger");
        const spy = jest.spyOn(logger, "info");

        const res = await post("/settings", { lead_time_dias: 10, horizonte_dias: 5 });
        expect(res.status).toBe(400);

        const logs = spy.mock.calls.filter(([msg]) =>
          String(msg).includes("pickup_scheduling.cambio")
        );
        spy.mockRestore();
        expect(logs).toHaveLength(0);
        expect(await pickup.listPickupScheduleChanges({})).toHaveLength(antes);
      });

      it("la auditoría es de solo lectura: no se puede editar ni borrar", async () => {
        await post("/settings", { capacidad_por_defecto: 20 });
        const [row] = await pickup.listPickupScheduleChanges(
          {},
          { order: { created_at: "DESC" }, take: 1 }
        );

        await expect(
          pickup.updatePickupScheduleChanges({ id: row.id, actor_email: "otro@x.cl" })
        ).rejects.toThrow(/solo lectura/);
        await expect(pickup.deletePickupScheduleChanges(row.id)).rejects.toThrow(
          /solo lectura/
        );
        await expect(pickup.softDeletePickupScheduleChanges(row.id)).rejects.toThrow(
          /solo lectura/
        );

        expect(await pickup.retrievePickupScheduleChange(row.id)).toMatchObject({
          actor_email: "admin@medusa.js",
        });
      });
    });

    describe("cupo de un pedido y pedidos en días cerrados", () => {
      const comprar = async () => {
        const cart = await readyCart(api, shop, [{ variant_id: shop.litro, quantity: 1 }]);
        const fecha = (await api.get(`/store/carts/${cart.id}`, shop.storeHeaders)).data
          .cart.metadata.pickup_date as string;
        const res = await complete(api, cart.id, shop.storeHeaders);
        expect(res.status).toBe(200);
        const order = res.data.order;
        await waitFor(async () => {
          const [b] = await pickup.listPickupBookings({ order_id: order.id });
          return b?.estado === "confirmado";
        });
        return { order, fecha };
      };

      it("muestra el site, la fecha y el estado del cupo de un pedido", async () => {
        const { order, fecha } = await comprar();

        const res = await get(`/bookings?order_id=${order.id}`);
        expect(res.status).toBe(200);
        expect(res.data.bookings).toEqual([
          expect.objectContaining({
            order_id: order.id,
            stock_location_id: shop.site.id,
            site_name: shop.site.name,
            fecha,
            estado: "confirmado",
            order: expect.objectContaining({ display_id: order.display_id }),
          }),
        ]);

        await api.post(`/admin/orders/${order.id}/cancel`, {}, adminHeaders);
        await waitFor(
          async () =>
            (await get(`/bookings?order_id=${order.id}`)).data.bookings[0]?.estado ===
            "liberado"
        );

        // Liberado ya no cuenta como pedido agendado ese día
        expect((await get(`/bookings?fecha=${fecha}`)).data.bookings).toHaveLength(0);
      });

      it("lista los pedidos agendados de una fecha y exige order_id o fecha", async () => {
        const { order, fecha } = await comprar();

        const delSite = await get(`/bookings?fecha=${fecha}&stock_location_id=${shop.site.id}`);
        expect(delSite.data.bookings.map((b: any) => b.order_id)).toEqual([order.id]);

        const deOtro = await get(`/bookings?fecha=${fecha}&stock_location_id=sloc_otro`);
        expect(deOtro.data.bookings).toHaveLength(0);

        expect((await get(`/bookings`)).status).toBe(400);
        expect((await get(`/bookings?fecha=hoy`)).status).toBe(400);
      });

      it("un pedido sin cupo (creado fuera del checkout) responde una lista vacía", async () => {
        const res = await get(`/bookings?order_id=order_inexistente`);
        expect(res.status).toBe(200);
        expect(res.data.bookings).toEqual([]);
      });

      it("cerrar un día con pedidos los lista como conflicto hasta que se reabre", async () => {
        const { order, fecha } = await comprar();
        expect((await get("/conflicts")).data.conflicts).toEqual([]);

        const cierre = await post("/exceptions", {
          fecha,
          stock_location_id: shop.site.id,
          tipo: "cerrado",
          motivo: "Corte de agua",
        });
        expect(cierre.status).toBe(200);

        // Cerrar no anula ni mueve el pedido
        const [b] = await pickup.listPickupBookings({ order_id: order.id });
        expect(b).toMatchObject({ estado: "confirmado", fecha });

        const { conflicts } = (await get("/conflicts")).data;
        expect(conflicts).toEqual([
          expect.objectContaining({
            order_id: order.id,
            stock_location_id: shop.site.id,
            site_name: shop.site.name,
            fecha,
            motivo: "Corte de agua",
            origen: "excepcion_site",
            order: expect.objectContaining({ display_id: order.display_id }),
          }),
        ]);

        await del(`/exceptions/${cierre.data.exception.id}`);
        expect((await get("/conflicts")).data.conflicts).toEqual([]);
      });

      it("cerrar el día de la semana en el horario del site también genera conflicto", async () => {
        const { order, fecha } = await comprar();
        const dia = ((new Date(`${fecha}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;

        await post(`/sites/${shop.site.id}/horario/${dia}`, { abierto: false });

        const { conflicts } = (await get("/conflicts")).data;
        expect(conflicts.map((c: any) => c.order_id)).toEqual([order.id]);
        expect(conflicts[0].origen).toBe("horario_site");
      });

      it("un pedido anulado deja de aparecer como conflicto", async () => {
        const { order, fecha } = await comprar();
        await post("/exceptions", { fecha, tipo: "feriado", motivo: "Feriado" });
        expect((await get("/conflicts")).data.conflicts).toHaveLength(1);

        await api.post(`/admin/orders/${order.id}/cancel`, {}, adminHeaders);
        await waitFor(
          async () => (await get("/conflicts")).data.conflicts.length === 0
        );
      });
    });
  },
});
