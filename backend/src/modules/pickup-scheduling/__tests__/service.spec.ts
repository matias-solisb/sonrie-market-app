import { moduleIntegrationTestRunner } from "@medusajs/test-utils";
import { PICKUP_SCHEDULING_MODULE } from "..";
import PickupSchedulingModuleService from "../service";
import {
  PickupBooking,
  PickupOccupancy,
  PickupScheduleChange,
  PickupSetting,
  SiteSchedule,
  SiteScheduleException,
  SiteSlotConfig,
} from "../models";

jest.setTimeout(60 * 1000);

/*

Pruebas del servicio contra una BD real (npm run test:integration:modules).
Cubren la resolución de días (precedencia de reglas), el rango elegible en
hora de Santiago y el ciclo del cupo que usará el checkout: reserva,
idempotencia, concurrencia, compensación, confirmación y liberación.

"Hoy" = miércoles 7-oct-2026, 12:00 en Santiago (UTC-3). Con los valores
por defecto (lead-time 1, horizonte 14) el rango es 8-oct → 21-oct.

*/

const SITE = "sloc_test_a";
const SITE_B = "sloc_test_b";
const NOW = new Date("2026-10-07T15:00:00Z");

const JUE = "2026-10-08";
const VIE = "2026-10-09";
const SAB = "2026-10-10";
const LUN_FERIADO = "2026-10-12";
const NAVIDAD = "2026-12-25";

moduleIntegrationTestRunner<PickupSchedulingModuleService>({
  moduleName: PICKUP_SCHEDULING_MODULE,
  moduleModels: [
    PickupSetting,
    SiteSlotConfig,
    SiteSchedule,
    SiteScheduleException,
    PickupOccupancy,
    PickupBooking,
    PickupScheduleChange,
  ],
  resolve: "./src/modules/pickup-scheduling",
  testSuite: ({ service }) => {
    const ocupados = async (site: string, fecha: string) => {
      const [row] = await service.listPickupOccupancies({
        stock_location_id: site,
        fecha,
      });

      return row?.ocupados ?? 0;
    };

    const dia = async (site: string, fecha: string) => {
      const [day] = await service.resolveDays(site, [fecha]);

      return day;
    };

    describe("configuración global", () => {
      it("se crea con los valores por defecto y una sola vez", async () => {
        const a = await service.getSettings();
        const b = await service.getSettings();

        expect(a).toEqual({
          id: expect.any(String),
          capacidad_por_defecto: null,
          lead_time_dias: 1,
          horizonte_dias: 14,
          dias_abiertos_por_defecto: [1, 2, 3, 4, 5],
        });
        expect(b.id).toBe(a.id);
        expect(await service.listPickupSettings()).toHaveLength(1);
      });

      it("rechaza un horizonte menor que el lead-time", async () => {
        await expect(
          service.updateSettings({ lead_time_dias: 5, horizonte_dias: 3 })
        ).rejects.toThrow("horizonte no puede ser menor");
      });

      it("rechaza días de la semana fuera de 1–7", async () => {
        await expect(
          service.updateSettings({ dias_abiertos_por_defecto: [1, 8] })
        ).rejects.toThrow("Día de la semana inválido");
      });

      it("rechaza capacidades negativas o con decimales", async () => {
        await expect(
          service.updateSettings({ capacidad_por_defecto: -1 })
        ).rejects.toThrow("entero mayor o igual a 0");
        await expect(
          service.upsertSiteSlotConfig({
            stock_location_id: SITE,
            capacidad_diaria: 2.5,
          })
        ).rejects.toThrow("entero mayor o igual a 0");
      });
    });

    describe("resolución de un día", () => {
      beforeEach(async () => {
        await service.updateSettings({ capacidad_por_defecto: 10 });
      });

      it("sin reglas propias usa los días y la capacidad por defecto", async () => {
        expect(await dia(SITE, JUE)).toMatchObject({
          abierto: true,
          capacidad: 10,
          origen: "por_defecto",
        });
        expect(await dia(SITE, SAB)).toMatchObject({
          abierto: false,
          capacidad: 0,
          origen: "por_defecto",
        });
      });

      it("sin capacidad en ningún nivel queda abierto pero sin configurar", async () => {
        await service.updateSettings({ capacidad_por_defecto: null });

        expect(await dia(SITE, JUE)).toMatchObject({
          abierto: true,
          capacidad: null,
        });
      });

      it("la capacidad del site gana a la global", async () => {
        await service.upsertSiteSlotConfig({
          stock_location_id: SITE,
          capacidad_diaria: 5,
        });

        expect((await dia(SITE, JUE)).capacidad).toBe(5);
        expect((await dia(SITE_B, JUE)).capacidad).toBe(10);
      });

      it("el horario semanal del site abre el sábado con menos cupos y cierra el viernes", async () => {
        await service.upsertSiteSlotConfig({
          stock_location_id: SITE,
          capacidad_diaria: 5,
        });
        await service.upsertSiteSchedule({
          stock_location_id: SITE,
          dia_semana: 6,
          abierto: true,
          capacidad: 3,
        });
        await service.upsertSiteSchedule({
          stock_location_id: SITE,
          dia_semana: 5,
          abierto: false,
        });

        expect(await dia(SITE, SAB)).toMatchObject({
          abierto: true,
          capacidad: 3,
          origen: "horario_site",
        });
        expect(await dia(SITE, VIE)).toMatchObject({
          abierto: false,
          origen: "horario_site",
        });
        // Otro día con fila de horario pero sin capacidad propia → la del site.
        await service.upsertSiteSchedule({
          stock_location_id: SITE,
          dia_semana: 4,
          abierto: true,
        });
        expect((await dia(SITE, JUE)).capacidad).toBe(5);
      });

      it("actualizar un día sin capacidad conserva la guardada; cerrarlo la limpia", async () => {
        const upsert = (data: { abierto: boolean; capacidad?: number | null }) =>
          service.upsertSiteSchedule({
            stock_location_id: SITE,
            dia_semana: 6,
            ...data,
          });
        const sabado = async () => {
          const [row] = await service.listSiteSchedules({
            stock_location_id: SITE,
            dia_semana: 6,
          });
          return row;
        };

        await upsert({ abierto: true, capacidad: 3 });
        await upsert({ abierto: true });
        expect((await sabado()).capacidad).toBe(3);

        await upsert({ abierto: false });
        expect(await sabado()).toMatchObject({ abierto: false, capacidad: null });

        await upsert({ abierto: true, capacidad: null });
        expect((await sabado()).capacidad).toBeNull();
      });

      it("guarda los días abiertos por defecto ordenados y sin repetir", async () => {
        const setting = await service.updateSettings({
          dias_abiertos_por_defecto: [6, 1, 3, 1],
        });

        expect(setting.dias_abiertos_por_defecto).toEqual([1, 3, 6]);
      });

      it("un feriado global cierra todos los sites salvo el que tiene apertura especial", async () => {
        await service.createException({
          fecha: LUN_FERIADO,
          tipo: "feriado",
          motivo: "Encuentro de Dos Mundos",
        });
        await service.createException({
          fecha: LUN_FERIADO,
          stock_location_id: SITE,
          tipo: "abierto",
          capacidad: 4,
          motivo: "Se trabaja el feriado",
        });

        expect(await dia(SITE, LUN_FERIADO)).toMatchObject({
          abierto: true,
          capacidad: 4,
          origen: "excepcion_site",
        });
        expect(await dia(SITE_B, LUN_FERIADO)).toMatchObject({
          abierto: false,
          origen: "excepcion_global",
          motivo: "Encuentro de Dos Mundos",
        });
      });

      it("una apertura especial sin capacidad usa la del día", async () => {
        await service.createException({
          fecha: SAB,
          stock_location_id: SITE,
          tipo: "abierto",
        });

        expect(await dia(SITE, SAB)).toMatchObject({
          abierto: true,
          capacidad: 10,
        });
      });

      it("un cierre del site gana a su horario", async () => {
        await service.createException({
          fecha: JUE,
          stock_location_id: SITE,
          tipo: "cerrado",
          motivo: "Inventario",
        });

        expect(await dia(SITE, JUE)).toMatchObject({
          abierto: false,
          origen: "excepcion_site",
          motivo: "Inventario",
        });
        expect((await dia(SITE_B, JUE)).abierto).toBe(true);
      });

      it("un feriado irrenunciable no se puede abrir", async () => {
        await service.createException({
          fecha: NAVIDAD,
          tipo: "feriado",
          irrenunciable: true,
          motivo: "Navidad",
        });

        await expect(
          service.createException({
            fecha: NAVIDAD,
            stock_location_id: SITE,
            tipo: "abierto",
          })
        ).rejects.toThrow("feriado irrenunciable");
      });

      it("una apertura creada antes de marcar el feriado irrenunciable se ignora", async () => {
        await service.createException({
          fecha: NAVIDAD,
          stock_location_id: SITE,
          tipo: "abierto",
        });
        await service.createException({
          fecha: NAVIDAD,
          tipo: "feriado",
          irrenunciable: true,
        });

        expect(await dia(SITE, NAVIDAD)).toMatchObject({
          abierto: false,
          origen: "feriado_irrenunciable",
        });
      });

      it("valida las excepciones", async () => {
        await expect(
          service.createException({
            fecha: NAVIDAD,
            stock_location_id: SITE,
            tipo: "feriado",
            irrenunciable: true,
          })
        ).rejects.toThrow("irrenunciable");
        await expect(
          service.createException({ fecha: JUE, tipo: "cerrado", capacidad: 3 })
        ).rejects.toThrow("La capacidad solo se puede indicar");
        await expect(
          service.createException({ fecha: "2026-02-30", tipo: "feriado" })
        ).rejects.toThrow("Fecha inválida");

        await service.createException({ fecha: JUE, tipo: "cerrado" });
        await expect(
          service.createException({ fecha: JUE, tipo: "feriado" })
        ).rejects.toThrow("Ya existe una excepción global");
      });
    });

    describe("fechas disponibles", () => {
      beforeEach(async () => {
        await service.updateSettings({ capacidad_por_defecto: 2 });
      });

      it("ofrece de hoy + lead-time a hoy + horizonte", async () => {
        const fechas = await service.listAvailableDates(SITE, NOW);

        expect(fechas).toHaveLength(14);
        expect(fechas[0].fecha).toBe(JUE);
        expect(fechas[fechas.length - 1].fecha).toBe("2026-10-21");
        expect(fechas.find((f) => f.fecha === SAB)).toMatchObject({
          abierto: false,
          disponibles: 0,
        });
      });

      it("el lead-time y el horizonte del site ganan a los globales", async () => {
        await service.upsertSiteSlotConfig({
          stock_location_id: SITE,
          lead_time_dias: 2,
          horizonte_dias: 5,
        });

        const fechas = await service.listAvailableDates(SITE, NOW);

        expect(fechas.map((f) => f.fecha)).toEqual([
          VIE,
          SAB,
          "2026-10-11",
          LUN_FERIADO,
        ]);
      });

      it("'hoy' cambia a medianoche de Santiago, no de UTC", async () => {
        const antes = await service.getWindow(
          SITE,
          new Date("2026-10-08T02:59:00Z") // 7-oct 23:59 en Santiago
        );
        const despues = await service.getWindow(
          SITE,
          new Date("2026-10-08T03:00:00Z") // 8-oct 00:00 en Santiago
        );

        expect(antes.desde).toBe(JUE);
        expect(despues.desde).toBe(VIE);
      });

      it("descuenta los cupos tomados", async () => {
        await service.reserveBooking({
          cart_id: "cart_1",
          stock_location_id: SITE,
          fecha: JUE,
          now: NOW,
        });

        const fechas = await service.listAvailableDates(SITE, NOW);

        expect(fechas[0]).toMatchObject({
          fecha: JUE,
          capacidad: 2,
          ocupados: 1,
          disponibles: 1,
        });
      });
    });

    describe("validación sin reservar (assertDateBookable)", () => {
      beforeEach(async () => {
        await service.updateSettings({ capacidad_por_defecto: 1 });
      });

      const validar = (fecha: string) =>
        service.assertDateBookable(SITE, fecha, NOW);

      it("devuelve la capacidad y la ocupación sin tomar el cupo", async () => {
        expect(await validar(JUE)).toEqual({ capacidad: 1, ocupados: 0 });
        expect(await ocupados(SITE, JUE)).toBe(0);
        expect(await service.listPickupBookings({})).toHaveLength(0);
      });

      it("rechaza con los mismos mensajes que la reserva", async () => {
        await expect(validar("2026-10-07")).rejects.toThrow("debe ser desde el 08-10-2026");
        await expect(validar("2026-10-22")).rejects.toThrow("debe ser hasta el 21-10-2026");
        await expect(validar(SAB)).rejects.toThrow("no atiende retiros el 10-10-2026");
        await expect(validar("2026-13-01")).rejects.toThrow("Elige una fecha de retiro válida");

        await service.reserveBooking({
          cart_id: "cart_1",
          stock_location_id: SITE,
          fecha: JUE,
          now: NOW,
        });
        await expect(validar(JUE)).rejects.toThrow(
          "No quedan cupos de retiro para el 08-10-2026"
        );

        await service.updateSettings({ capacidad_por_defecto: null });
        await expect(validar(VIE)).rejects.toThrow("agenda de retiro no está configurada");
      });
    });

    describe("reserva del cupo", () => {
      beforeEach(async () => {
        await service.updateSettings({ capacidad_por_defecto: 2 });
      });

      const reservar = (cart_id: string, fecha = JUE, site = SITE) =>
        service.reserveBooking({
          cart_id,
          stock_location_id: site,
          fecha,
          now: NOW,
        });

      it("toma el cupo y lo registra como reservado", async () => {
        const result = await reservar("cart_1");

        expect(result).toMatchObject({ fecha: JUE, created: true });
        expect(await ocupados(SITE, JUE)).toBe(1);

        const booking = await service.retrievePickupBooking(result.booking_id);
        expect(booking).toMatchObject({
          cart_id: "cart_1",
          estado: "reservado",
          order_id: null,
          bloque: null,
        });
      });

      it("es idempotente por carrito", async () => {
        const a = await reservar("cart_1");
        const b = await reservar("cart_1");

        expect(b).toMatchObject({ booking_id: a.booking_id, created: false });
        expect(await ocupados(SITE, JUE)).toBe(1);
      });

      it("si el carrito cambia de fecha, mueve el cupo", async () => {
        await reservar("cart_1", JUE);
        const b = await reservar("cart_1", VIE);

        expect(b.created).toBe(true);
        expect(await ocupados(SITE, JUE)).toBe(0);
        expect(await ocupados(SITE, VIE)).toBe(1);
        expect(await service.listPickupBookings({ cart_id: "cart_1" })).toHaveLength(1);
      });

      it("no mueve ni borra el cupo de un pedido ya creado", async () => {
        const { booking_id } = await reservar("cart_1", JUE);
        await service.confirmBooking("cart_1", "order_1");

        await expect(reservar("cart_1", VIE)).rejects.toThrow(
          "ya tiene un pedido con fecha de retiro asignada"
        );
        // Tampoco con la misma fecha: el cupo ya es del pedido.
        await expect(reservar("cart_1", JUE)).rejects.toThrow(
          "ya tiene un pedido"
        );

        expect(await service.retrievePickupBooking(booking_id)).toMatchObject({
          order_id: "order_1",
          estado: "confirmado",
          fecha: JUE,
        });
        expect(await ocupados(SITE, JUE)).toBe(1);
        expect(await ocupados(SITE, VIE)).toBe(0);
      });

      it("rechaza fechas fuera del rango elegible", async () => {
        await expect(reservar("cart_1", "2026-10-07")).rejects.toThrow(
          "debe ser desde el 08-10-2026"
        );
        await expect(reservar("cart_1", "2026-10-22")).rejects.toThrow(
          "debe ser hasta el 21-10-2026"
        );
        await expect(reservar("cart_1", "no-es-fecha")).rejects.toThrow(
          "Elige una fecha de retiro válida"
        );
      });

      it("rechaza un día cerrado, con el motivo", async () => {
        await service.createException({
          fecha: LUN_FERIADO,
          tipo: "feriado",
          motivo: "Encuentro de Dos Mundos",
        });

        await expect(reservar("cart_1", SAB)).rejects.toThrow(
          "no atiende retiros el 10-10-2026"
        );
        await expect(reservar("cart_1", LUN_FERIADO)).rejects.toThrow(
          "(Encuentro de Dos Mundos)"
        );
      });

      it("rechaza cuando la agenda no está configurada", async () => {
        await service.updateSettings({ capacidad_por_defecto: null });

        await expect(reservar("cart_1")).rejects.toThrow(
          "agenda de retiro no está configurada"
        );
      });

      it("rechaza cuando no quedan cupos", async () => {
        await reservar("cart_1");
        await reservar("cart_2");

        await expect(reservar("cart_3")).rejects.toThrow(
          "No quedan cupos de retiro para el 08-10-2026"
        );
        expect(await ocupados(SITE, JUE)).toBe(2);
      });

      it("los cupos son por site", async () => {
        await reservar("cart_1");
        await reservar("cart_2");
        await reservar("cart_3", JUE, SITE_B);

        expect(await ocupados(SITE_B, JUE)).toBe(1);
      });

      it("dos checkouts simultáneos por el último cupo: solo uno pasa", async () => {
        await service.updateSettings({ capacidad_por_defecto: 1 });

        const results = await Promise.allSettled([
          reservar("cart_1"),
          reservar("cart_2"),
          reservar("cart_3"),
        ]);

        expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
        expect(await ocupados(SITE, JUE)).toBe(1);
        expect(await service.listPickupBookings({ fecha: JUE })).toHaveLength(1);
      });

      it("bajar la capacidad no toca las reservas existentes, solo bloquea nuevas", async () => {
        await reservar("cart_1");
        await reservar("cart_2");
        await service.updateSettings({ capacidad_por_defecto: 1 });

        expect(await ocupados(SITE, JUE)).toBe(2);
        expect(await service.listPickupBookings({ fecha: JUE })).toHaveLength(2);

        const [jueves] = await service.listAvailableDates(SITE, NOW);
        expect(jueves).toMatchObject({ capacidad: 1, ocupados: 2, disponibles: 0 });

        await expect(reservar("cart_3")).rejects.toThrow("No quedan cupos");
      });
    });

    describe("compensación, confirmación y liberación", () => {
      beforeEach(async () => {
        await service.updateSettings({ capacidad_por_defecto: 2 });
      });

      const reservar = (cart_id: string) =>
        service.reserveBooking({
          cart_id,
          stock_location_id: SITE,
          fecha: JUE,
          now: NOW,
        });

      it("revertBooking devuelve el cupo y permite reintentar el mismo carrito", async () => {
        const { booking_id } = await reservar("cart_1");

        await service.revertBooking(booking_id);
        await service.revertBooking(booking_id); // ya no existe: no hace nada

        expect(await ocupados(SITE, JUE)).toBe(0);
        expect(await service.listPickupBookings({ cart_id: "cart_1" })).toHaveLength(0);

        const again = await reservar("cart_1");
        expect(again.created).toBe(true);
        expect(await ocupados(SITE, JUE)).toBe(1);
      });

      it("confirmBooking asocia el pedido y confirma, de forma idempotente", async () => {
        const { booking_id } = await reservar("cart_1");

        expect(await service.confirmBooking("cart_1", "order_1")).toBe(booking_id);
        expect(await service.confirmBooking("cart_1", "order_1")).toBe(booking_id);
        expect(await service.confirmBooking("cart_sin_cupo", "order_2")).toBeNull();

        expect(await service.retrievePickupBooking(booking_id)).toMatchObject({
          order_id: "order_1",
          estado: "confirmado",
        });
      });

      it("anular un pedido cuya fecha de retiro ya pasó libera el cupo sin error", async () => {
        // JUE es anterior a hoy cuando corre el test: la liberación no
        // depende de la fecha (un pedido no retirado se puede anular después).
        const { booking_id } = await reservar("cart_1");
        await service.confirmBooking("cart_1", "order_1");

        const result = await service.releaseBookingByOrder({ order_id: "order_1" });

        expect(result).toMatchObject({ booking_id, released: true });
        expect(await ocupados(SITE, JUE)).toBe(0);
        expect(await service.retrievePickupBooking(booking_id)).toMatchObject({
          estado: "liberado",
        });
      });

      it("listBookingConflicts: pedidos agendados en un día que después se cerró", async () => {
        await reservar("cart_1");
        await service.confirmBooking("cart_1", "order_1");
        await service.reserveBooking({
          cart_id: "cart_2",
          stock_location_id: SITE_B,
          fecha: JUE,
          now: NOW,
        });

        expect(await service.listBookingConflicts(NOW)).toEqual([]);

        await service.createException({
          fecha: JUE,
          stock_location_id: SITE,
          tipo: "cerrado",
          motivo: "Inventario",
        });

        // Solo el del site cerrado; el pedido sigue confirmado
        expect(await service.listBookingConflicts(NOW)).toEqual([
          expect.objectContaining({
            cart_id: "cart_1",
            order_id: "order_1",
            stock_location_id: SITE,
            fecha: JUE,
            estado: "confirmado",
            origen: "excepcion_site",
            motivo: "Inventario",
          }),
        ]);

        // Un feriado global alcanza también al otro site
        await service.createException({ fecha: JUE, tipo: "feriado", motivo: "Feriado" });
        expect((await service.listBookingConflicts(NOW)).map((c) => c.cart_id).sort()).toEqual([
          "cart_1",
          "cart_2",
        ]);

        // Los liberados y las fechas pasadas no cuentan
        await service.releaseBookingByOrder({ order_id: "order_1" });
        expect((await service.listBookingConflicts(NOW)).map((c) => c.cart_id)).toEqual([
          "cart_2",
        ]);
        expect(
          await service.listBookingConflicts(new Date("2026-10-09T15:00:00Z"))
        ).toEqual([]);
      });

      it("releaseBookingByOrder libera una sola vez", async () => {
        const { booking_id } = await reservar("cart_1");
        await service.confirmBooking("cart_1", "order_1");

        const first = await service.releaseBookingByOrder({ order_id: "order_1" });
        const second = await service.releaseBookingByOrder({ order_id: "order_1" });

        expect(first).toEqual({
          booking_id,
          estado_anterior: "confirmado",
          released: true,
        });
        expect(second).toMatchObject({ released: false });
        expect(await ocupados(SITE, JUE)).toBe(0);
        expect((await service.retrievePickupBooking(booking_id)).estado).toBe(
          "liberado"
        );
      });

      it("encuentra el cupo por carrito si el pedido aún no estaba asociado", async () => {
        await reservar("cart_1");

        const result = await service.releaseBookingByOrder({
          order_id: "order_1",
          cart_id: "cart_1",
        });

        expect(result).toMatchObject({
          estado_anterior: "reservado",
          released: true,
        });
        expect(await ocupados(SITE, JUE)).toBe(0);
      });

      it("devuelve null si el pedido no tenía cupo", async () => {
        expect(
          await service.releaseBookingByOrder({ order_id: "order_x" })
        ).toBeNull();
      });

      it("undoRelease restaura el estado y la ocupación", async () => {
        const { booking_id } = await reservar("cart_1");
        await service.confirmBooking("cart_1", "order_1");
        const release = await service.releaseBookingByOrder({
          order_id: "order_1",
        });

        await service.undoRelease(booking_id, release!.estado_anterior);
        await service.undoRelease(booking_id, release!.estado_anterior); // idempotente

        expect((await service.retrievePickupBooking(booking_id)).estado).toBe(
          "confirmado"
        );
        expect(await ocupados(SITE, JUE)).toBe(1);
      });

      it("un cupo liberado no se revive al confirmar", async () => {
        const { booking_id } = await reservar("cart_1");
        await service.releaseBookingByOrder({ order_id: "x", cart_id: "cart_1" });
        await service.confirmBooking("cart_1", "order_1");

        expect((await service.retrievePickupBooking(booking_id)).estado).toBe(
          "liberado"
        );
      });
    });

    describe("administración: excepciones, horario, feriados y auditoría", () => {
      const ADMIN = "user_admin_01";

      const cambios = () =>
        service.listPickupScheduleChanges({}, { order: { created_at: "ASC" } });

      it("guarda el correo del usuario si se lo pasan, y acepta solo el id", async () => {
        await service.updateSettings(
          { capacidad_por_defecto: 5 },
          { id: "user_1", email: "ana@soprole.cl" }
        );
        await service.updateSettings({ capacidad_por_defecto: 6 }, "user_2");

        const rows = await service.listPickupScheduleChanges(
          { entidad: "configuracion" },
          { order: { created_at: "ASC" } }
        );
        expect(rows.slice(-2)).toEqual([
          expect.objectContaining({ actor_id: "user_1", actor_email: "ana@soprole.cl" }),
          expect.objectContaining({ actor_id: "user_2", actor_email: null }),
        ]);
      });

      it("registra quién cambió la configuración y qué valores tenía", async () => {
        await service.updateSettings({ capacidad_por_defecto: 10 }, ADMIN);
        await service.updateSettings({ capacidad_por_defecto: 10 }, ADMIN); // sin cambios

        const [change, ...rest] = await cambios();
        expect(rest).toHaveLength(0);
        expect(change).toMatchObject({
          actor_id: ADMIN,
          entidad: "configuracion",
          accion: "editar",
          cambios: { capacidad_por_defecto: { anterior: null, nuevo: 10 } },
        });
      });

      it("audita la configuración del site y el horario, y quitar un día vuelve al general", async () => {
        await service.updateSettings({ capacidad_por_defecto: 10 });
        await service.upsertSiteSlotConfig(
          { stock_location_id: SITE, capacidad_diaria: 5 },
          ADMIN
        );
        await service.upsertSiteSchedule(
          { stock_location_id: SITE, dia_semana: 6, abierto: true, capacidad: 3 },
          ADMIN
        );
        expect(await dia(SITE, SAB)).toMatchObject({ abierto: true, capacidad: 3 });

        await service.deleteSiteSchedule(SITE, 6, ADMIN);
        await service.deleteSiteSchedule(SITE, 6, ADMIN); // ya no existe: nada

        expect(await dia(SITE, SAB)).toMatchObject({
          abierto: false,
          origen: "por_defecto",
        });

        const registro = (await cambios()).filter((c) => c.actor_id === ADMIN);
        expect(registro.map((c) => [c.entidad, c.accion, c.referencia])).toEqual([
          ["site", "crear", null],
          ["horario", "crear", "6"],
          ["horario", "eliminar", "6"],
        ]);
        expect(registro[0]).toMatchObject({
          stock_location_id: SITE,
          cambios: { capacidad_diaria: { anterior: null, nuevo: 5 } },
        });
      });

      it("edita una excepción con las mismas reglas que al crearla", async () => {
        const exc = await service.createException(
          { fecha: LUN_FERIADO, tipo: "feriado", motivo: "Encuentro" },
          ADMIN
        );

        const editada = await service.updateException(
          exc.id,
          { irrenunciable: true, motivo: "Encuentro de Dos Mundos" },
          ADMIN
        );
        expect(editada).toMatchObject({
          irrenunciable: true,
          motivo: "Encuentro de Dos Mundos",
        });

        // Pasar a "cerrado" limpia el irrenunciable (solo aplica a feriados).
        const cerrada = await service.updateException(exc.id, { tipo: "cerrado" });
        expect(cerrada.irrenunciable).toBe(false);

        await expect(
          service.updateException(exc.id, { stock_location_id: SITE, irrenunciable: true })
        ).rejects.toThrow("irrenunciable");

        // No puede chocar con otra excepción global de la misma fecha.
        const otra = await service.createException({ fecha: JUE, tipo: "cerrado" });
        await expect(
          service.updateException(otra.id, { fecha: LUN_FERIADO })
        ).rejects.toThrow("Ya existe una excepción global el 12-10-2026");

        const registro = (await cambios()).filter(
          (c) => c.entidad === "excepcion" && c.actor_id === ADMIN
        );
        expect(registro.map((c) => c.accion)).toEqual(["crear", "editar"]);
        expect(registro[1].cambios).toEqual({
          irrenunciable: { anterior: false, nuevo: true },
          motivo: { anterior: "Encuentro", nuevo: "Encuentro de Dos Mundos" },
        });
      });

      it("elimina una excepción y lo registra", async () => {
        await service.updateSettings({ capacidad_por_defecto: 10 });
        const exc = await service.createException({
          fecha: JUE,
          stock_location_id: SITE,
          tipo: "cerrado",
        });
        expect((await dia(SITE, JUE)).abierto).toBe(false);

        await service.deleteException(exc.id, ADMIN);
        await service.deleteException(exc.id, ADMIN); // ya no existe: nada

        expect((await dia(SITE, JUE)).abierto).toBe(true);
        const [ultimo] = (await cambios()).slice(-1);
        expect(ultimo).toMatchObject({
          entidad: "excepcion",
          accion: "eliminar",
          referencia: JUE,
          stock_location_id: SITE,
        });
      });

      it("carga los feriados de Chile una sola vez y respeta los ya editados", async () => {
        await service.createException({
          fecha: LUN_FERIADO,
          tipo: "cerrado",
          motivo: "Editado a mano",
        });

        const first = await service.loadHolidays(2026, ADMIN);
        const second = await service.loadHolidays(2026, ADMIN);

        expect(first.creados).toHaveLength(15);
        expect(first.omitidos).toEqual([LUN_FERIADO]);
        expect(second.creados).toHaveLength(0);
        expect(second.omitidos).toHaveLength(16);

        const [navidad] = await service.listSiteScheduleExceptions({
          fecha: NAVIDAD,
          stock_location_id: null,
        });
        expect(navidad).toMatchObject({
          tipo: "feriado",
          irrenunciable: true,
          motivo: "Navidad",
        });
        const [lunes] = await service.listSiteScheduleExceptions({ fecha: LUN_FERIADO });
        expect(lunes.motivo).toBe("Editado a mano");

        const registro = (await cambios()).filter((c) => c.referencia === "feriados-2026");
        expect(registro).toHaveLength(1);

        await expect(service.loadHolidays(2031)).rejects.toThrow(
          "No hay feriados cargados para 2031"
        );
      });

      it("listDays muestra la ocupación de cualquier rango", async () => {
        await service.updateSettings({ capacidad_por_defecto: 2 });
        await service.reserveBooking({
          cart_id: "cart_1",
          stock_location_id: SITE,
          fecha: JUE,
          now: NOW,
        });

        const dias = await service.listDays(SITE, "2026-10-01", "2026-10-10");
        expect(dias).toHaveLength(10);
        expect(dias.find((d) => d.fecha === JUE)).toMatchObject({
          capacidad: 2,
          ocupados: 1,
          disponibles: 1,
        });

        await expect(service.listDays(SITE, "2026-10-10", "2026-10-01")).rejects.toThrow(
          "no puede ser anterior"
        );
        await expect(service.listDays(SITE, "2026-01-01", "2026-12-31")).rejects.toThrow(
          "93 días"
        );
      });
    });
  },
});
