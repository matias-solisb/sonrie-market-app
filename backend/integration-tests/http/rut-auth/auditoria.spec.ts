import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { INotificationModuleService } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { LOCKOUT } from "../../../src/modules/rut-auth/config";
import { rutRef } from "../../../src/utils/auth-audit";
import { initialPasswordFromRut, normalizeRut } from "../../../src/utils/rut";
import {
  adminHeaders,
  CLAVE_COLABORADOR,
  createAdminUser,
  createColaboradorSession,
} from "../../utils/admin";
import { generatePublishableKey, generateStoreHeaders } from "../../utils/store";

jest.setTimeout(120 * 1000);

/*

Auditoría de acceso (rut-auth, paso 10) — npm run test:integration:http.

Cada acción deja su evento JSON `auth.*` en el log (utils/auth-audit.ts):
login correcto y fallido (con motivo), bloqueo, cambio de clave (primer
ingreso, voluntario, reset) y sus fallas, recuperación (solicitud y
resultado), habilitar / deshabilitar.

Identificación: customer_id si la cuenta existe; rut_ref (HMAC) si no.
Ningún evento lleva el RUT (en ningún formato), el correo, la clave ni el
token. IP desde X-Forwarded-For.

*/

const SECRET = "secreto-de-auditoria-para-tests-0123456789";
const EMAIL = "juana.perez@sonriemarket.cl";
const IP = "200.27.1.10";
const XFF = { "x-forwarded-for": `${IP}, 10.0.0.4` };

const status = (p: Promise<any>) =>
  p.then((r) => r.status).catch((e) => e.response?.status);

medusaIntegrationTestRunner({
  inApp: true,
  env: { JWT_SECRET: "supersecret", AUDIT_HASH_SECRET: SECRET },
  testSuite: ({ api, getContainer }) => {
    let lines: string[];
    let spy: jest.SpyInstance;

    beforeEach(() => {
      process.env.AUDIT_HASH_SECRET = SECRET;
      lines = [];
      const logger = getContainer().resolve(ContainerRegistrationKeys.LOGGER);
      spy = jest.spyOn(logger, "info").mockImplementation((msg: any) => {
        lines.push(String(msg));
        return undefined as any;
      });
    });

    afterEach(() => spy.mockRestore());

    const events = () =>
      lines
        .filter((l) => l.startsWith('{"evento":"auth.'))
        .map((l) => JSON.parse(l));

    const eventsOf = (evento: string) => events().filter((e) => e.evento === evento);

    const waitFor = async (evento: string, count = 1) => {
      for (let i = 0; i < 50; i++) {
        if (eventsOf(evento).length >= count) {
          return eventsOf(evento);
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      throw new Error(`No apareció ${evento}. Eventos: ${JSON.stringify(events())}`);
    };

    /** Ningún evento puede llevar datos personales ni secretos. */
    const expectNoSensitiveData = (secrets: string[]) => {
      for (const line of lines.filter((l) => l.includes('"evento":"auth.'))) {
        for (const s of secrets) {
          expect(line).not.toContain(s);
        }
      }
    };

    const sensitive = (rut: string, password?: string) => {
      const n = normalizeRut(rut)!;
      const [body] = n.split("-");
      return [
        body,
        n,
        n.replace("-", ""),
        body.replace(/\B(?=(\d{3})+(?!\d))/g, "."),
        EMAIL,
        ...(password ? [password] : []),
      ];
    };

    const colaborador = (cambiarClave = true) =>
      createColaboradorSession({
        api,
        container: getContainer(),
        email: EMAIL,
        cambiarClave,
      });

    const login = (rut: string, password: string) =>
      status(api.post("/auth/customer/rut", { rut, password }, { headers: XFF }));

    describe("login", () => {
      it("correcto → auth.login_ok con customer_id e IP", async () => {
        const { customer, rut } = await colaborador();
        lines = [];

        expect(await login(rut, CLAVE_COLABORADOR)).toBe(200);

        const [e] = eventsOf("auth.login_ok");
        expect(e).toMatchObject({
          customer_id: customer.id,
          canal: "login",
          ip: IP,
          ip_cadena: `${IP}, 10.0.0.4`,
        });
        expect(e.rut_ref).toBeUndefined();
        expectNoSensitiveData(sensitive(rut, CLAVE_COLABORADOR));
      });

      it("clave incorrecta → login_fallido clave_incorrecta con el contador", async () => {
        const { customer, rut } = await colaborador();
        lines = [];

        await login(rut, "ClaveEquivocada1");

        expect(eventsOf("auth.login_fallido")).toEqual([
          expect.objectContaining({
            motivo: "clave_incorrecta",
            customer_id: customer.id,
            intentos_fallidos: 1,
            ip: IP,
          }),
        ]);
        expect(eventsOf("auth.login_ok")).toHaveLength(0);
        expectNoSensitiveData(sensitive(rut, "ClaveEquivocada1"));
      });

      it("RUT inexistente → rut_ref (HMAC), sin customer_id ni RUT", async () => {
        await colaborador();
        lines = [];

        await login("11.111.111-1", "Cualquiera123");

        const [e] = eventsOf("auth.login_fallido");
        expect(e).toMatchObject({
          motivo: "rut_inexistente",
          customer_id: null,
          rut_ref: rutRef("11111111-1"),
        });
        expect(e.rut_ref).toMatch(/^[0-9a-f]{24}$/);
        expectNoSensitiveData(sensitive("11.111.111-1", "Cualquiera123"));
      });

      it("RUT inválido → motivo rut_invalido, sin identificar a nadie", async () => {
        lines = [];
        await login("12.345.678-4", "Cualquiera123");

        const [e] = eventsOf("auth.login_fallido");
        expect(e).toMatchObject({ motivo: "rut_invalido", customer_id: null });
        expect(e.rut_ref).toBeUndefined();
      });

      it(`${LOCKOUT.maxFailedAttempts} fallos → UN auth.bloqueo; después, cuenta_bloqueada`, async () => {
        const { customer, rut } = await colaborador();
        lines = [];

        for (let i = 0; i < LOCKOUT.maxFailedAttempts; i++) {
          await login(rut, `ClaveMala${i}xx`);
        }

        const bloqueos = eventsOf("auth.bloqueo");
        expect(bloqueos).toHaveLength(1);
        expect(bloqueos[0]).toMatchObject({
          customer_id: customer.id,
          intentos_fallidos: LOCKOUT.maxFailedAttempts,
          bloqueada_hasta: expect.any(String),
          canal: "login",
        });

        lines = [];
        await login(rut, CLAVE_COLABORADOR);

        expect(eventsOf("auth.login_fallido")).toEqual([
          expect.objectContaining({ motivo: "cuenta_bloqueada", customer_id: customer.id }),
        ]);
        expect(eventsOf("auth.bloqueo")).toHaveLength(0);
      });
    });

    describe("cambio de clave", () => {
      const cambiar = (token: string, current_password: string, password: string) =>
        status(
          api.post(
            "/store/customers/me/password",
            { current_password, password },
            { headers: { ...pk, authorization: `Bearer ${token}`, ...XFF } }
          )
        );

      let pk: Record<string, string>;

      beforeEach(async () => {
        pk = generateStoreHeaders({
          publishableKey: await generatePublishableKey(getContainer()),
        }).headers;
      });

      it("primer ingreso → auth.cambio_clave origen primer_ingreso", async () => {
        const { customer, rut, token } = await colaborador(false);
        lines = [];

        expect(await cambiar(token, initialPasswordFromRut(rut), "ClaveNuevaSegura")).toBe(200);

        expect(eventsOf("auth.cambio_clave")).toEqual([
          expect.objectContaining({
            customer_id: customer.id,
            origen: "primer_ingreso",
            ip: IP,
          }),
        ]);
        // La verificación de la clave actual no es un login.
        expect(eventsOf("auth.login_ok")).toHaveLength(0);
        expectNoSensitiveData(sensitive(rut, "ClaveNuevaSegura"));
      });

      it("voluntario → origen voluntario", async () => {
        const { token } = await colaborador();
        lines = [];

        expect(await cambiar(token, CLAVE_COLABORADOR, "OtraClaveSegura")).toBe(200);
        expect(eventsOf("auth.cambio_clave")[0]).toMatchObject({ origen: "voluntario" });
      });

      it("clave actual equivocada → cambio_clave_fallido + login_fallido canal cambio_clave", async () => {
        const { customer, token } = await colaborador();
        lines = [];

        expect(await cambiar(token, "NoEsMiClave1", "OtraClaveSegura")).toBe(400);

        expect(eventsOf("auth.cambio_clave_fallido")).toEqual([
          expect.objectContaining({
            customer_id: customer.id,
            motivo: "clave_actual_incorrecta",
          }),
        ]);
        expect(eventsOf("auth.login_fallido")).toEqual([
          expect.objectContaining({
            motivo: "clave_incorrecta",
            canal: "cambio_clave",
            customer_id: customer.id,
            ip: IP,
          }),
        ]);
        expect(eventsOf("auth.cambio_clave")).toHaveLength(0);
      });

      it("misma clave y clave que no cumple la política → motivos misma_clave y politica", async () => {
        const { token } = await colaborador();
        lines = [];

        await cambiar(token, CLAVE_COLABORADOR, CLAVE_COLABORADOR);
        await cambiar(token, CLAVE_COLABORADOR, "corta");

        expect(eventsOf("auth.cambio_clave_fallido").map((e) => e.motivo)).toEqual([
          "misma_clave",
          "politica",
        ]);
      });
    });

    describe("recuperación", () => {
      const pedirReset = (identifier: string) =>
        status(
          api.post("/auth/customer/rut/reset-password", { identifier }, { headers: XFF })
        );

      const resetToken = async () => {
        const notifications = getContainer().resolve<INotificationModuleService>(
          Modules.NOTIFICATION
        );
        for (let i = 0; i < 50; i++) {
          const [n] = await notifications.listNotifications({ to: EMAIL });
          if (n) {
            return new URL((n.data as any).reset_url).searchParams.get("token")!;
          }
          await new Promise((r) => setTimeout(r, 100));
        }
        throw new Error("No llegó la notificación");
      };

      const actualizar = (token: string, password: string) =>
        status(
          api.post(
            "/auth/customer/rut/update",
            { password },
            { headers: { Authorization: `Bearer ${token}`, ...XFF } }
          )
        );

      it("solicitud → reset_solicitado (rut_ref) y reset_enviado con el mismo rut_ref", async () => {
        const { customer, rut } = await colaborador();
        lines = [];

        expect(await pedirReset(rut)).toBe(201);

        const [enviado] = await waitFor("auth.reset_enviado");
        const [solicitado] = eventsOf("auth.reset_solicitado");

        expect(solicitado).toMatchObject({
          customer_id: null,
          rut_ref: rutRef(normalizeRut(rut)!),
          ip: IP,
        });
        expect(enviado).toMatchObject({
          customer_id: customer.id,
          rut_ref: solicitado.rut_ref,
          entrega: "console",
        });
        expectNoSensitiveData(sensitive(rut));
        // El token no aparece en ningún evento.
        const token = await resetToken();
        expectNoSensitiveData([token]);
      });

      it("RUT inexistente → solo reset_solicitado", async () => {
        await colaborador();
        lines = [];

        await pedirReset("11.111.111-1");
        await waitFor("auth.reset_solicitado");
        await new Promise((r) => setTimeout(r, 1000));

        expect(eventsOf("auth.reset_solicitado")[0]).toMatchObject({
          rut_ref: rutRef("11111111-1"),
        });
        expect(eventsOf("auth.reset_enviado")).toHaveLength(0);
        expect(eventsOf("auth.reset_no_enviado")).toHaveLength(0);
      });

      it("enlace usado → cambio_clave origen reset; reusarlo → cambio_clave_fallido enlace_invalido", async () => {
        const { customer, rut } = await colaborador();
        await pedirReset(rut);
        const token = await resetToken();
        lines = [];

        expect(await actualizar(token, "ClaveDelReset123")).toBe(200);
        expect((await waitFor("auth.cambio_clave"))[0]).toMatchObject({
          customer_id: customer.id,
          origen: "reset",
          ip: IP,
        });

        expect(await actualizar(token, "OtraClaveReset123")).toBe(401);
        expect((await waitFor("auth.cambio_clave_fallido"))[0]).toMatchObject({
          origen: "reset",
          motivo: "enlace_invalido",
          customer_id: null,
        });
        expectNoSensitiveData([...sensitive(rut, "ClaveDelReset123"), token]);
      });
    });

    describe("habilitar / deshabilitar", () => {
      let adminUserId: string;

      beforeEach(async () => {
        const { user } = await createAdminUser(adminHeaders, getContainer());
        adminUserId = user.id;
      });

      const habilitacion = (customerId: string, enabled: boolean) =>
        status(
          api.post(
            `/admin/colaboradores/${customerId}/habilitacion`,
            { enabled },
            { headers: { ...adminHeaders.headers, ...XFF } }
          )
        );

      it("registra quién lo hizo y el estado anterior; login deshabilitado → cuenta_deshabilitada", async () => {
        const { customer, rut } = await colaborador();
        lines = [];

        expect(await habilitacion(customer.id, false)).toBe(200);
        expect(eventsOf("auth.deshabilitar")).toEqual([
          expect.objectContaining({
            customer_id: customer.id,
            habilitada_antes: true,
            actor_id: adminUserId,
            ip: IP,
          }),
        ]);

        await login(rut, CLAVE_COLABORADOR);
        expect(eventsOf("auth.login_fallido")[0]).toMatchObject({
          motivo: "cuenta_deshabilitada",
          customer_id: customer.id,
        });

        expect(await habilitacion(customer.id, true)).toBe(200);
        expect(eventsOf("auth.habilitar")[0]).toMatchObject({
          customer_id: customer.id,
          habilitada_antes: false,
          actor_id: adminUserId,
        });
        expectNoSensitiveData(sensitive(rut, CLAVE_COLABORADOR));
      });

      it("solicitud de reset de una cuenta deshabilitada → reset_no_enviado cuenta_deshabilitada", async () => {
        const { customer, rut } = await colaborador();
        await habilitacion(customer.id, false);
        lines = [];

        await api.post("/auth/customer/rut/reset-password", { identifier: rut });

        expect((await waitFor("auth.reset_no_enviado"))[0]).toMatchObject({
          customer_id: customer.id,
          motivo: "cuenta_deshabilitada",
        });
      });
    });
  },
});
