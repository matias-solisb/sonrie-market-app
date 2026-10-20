import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import {
  ICustomerModuleService,
  INotificationModuleService,
} from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";
import {
  ACCOUNT_DISABLED_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
  LOCKOUT,
} from "../../../src/modules/rut-auth/config";
import { setColaboradorEnabledWorkflow } from "../../../src/workflows/colaborador/workflows";
import {
  adminHeaders,
  CLAVE_COLABORADOR,
  createAdminUser,
  createColaboradorSession,
} from "../../utils/admin";
import { generatePublishableKey, generateStoreHeaders } from "../../utils/store";

jest.setTimeout(120 * 1000);

/*

Habilitar / deshabilitar colaboradores (rut-auth, paso 9) —
npm run test:integration:http.

Admin
- GET  /admin/colaboradores/:customerId → estado (RUT, habilitado, …); 404 si
  el cliente no es colaborador; 401 sin sesión de admin.
- POST /admin/colaboradores/:customerId/habilitacion { enabled } → cambia y
  registra qué admin lo hizo; body inválido → 400.

Efectos de deshabilitar
- Login con la clave CORRECTA → 401 "Tu cuenta está deshabilitada…".
- Login con la clave incorrecta → el mensaje genérico (no revela nada).
- Bloqueada por intentos → el mensaje genérico, aun con la clave correcta.
- Sesión abierta → 401 account_disabled en toda la Store API.
- No se envía el correo de recuperación.
- Habilitar de nuevo → entra con la misma clave.

Workflow: RUT en cualquier formato; RUT inexistente → error.

*/

const status = (p: Promise<any>) =>
  p.then((r) => r.status).catch((e) => e.response?.status);

const errorOf = (p: Promise<any>) =>
  p.then(
    () => null,
    (e) => e.response
  );

const expectFails = async (p: Promise<any>, message?: RegExp) => {
  const error = await p.then(
    () => null,
    (e) => e
  );
  expect(error).not.toBeNull();
  if (message) {
    expect(error.message).toMatch(message);
  }
};

medusaIntegrationTestRunner({
  inApp: true,
  env: { JWT_SECRET: "supersecret" },
  testSuite: ({ api, getContainer }) => {
    let adminUserId: string;
    let pk: Record<string, string>;

    beforeEach(async () => {
      const { user } = await createAdminUser(adminHeaders, getContainer());
      adminUserId = user.id;
      pk = generateStoreHeaders({
        publishableKey: await generatePublishableKey(getContainer()),
      }).headers;
    });

    const colaborador = () =>
      createColaboradorSession({
        api,
        container: getContainer(),
        email: "juana.perez@sonriemarket.cl",
      });

    const habilitacion = (customerId: string, enabled: boolean) =>
      api.post(
        `/admin/colaboradores/${customerId}/habilitacion`,
        { enabled },
        adminHeaders
      );

    const login = (rut: string, password: string) =>
      errorOf(api.post("/auth/customer/rut", { rut, password })).then(
        (res) => res ?? { status: 200 }
      );

    describe("Admin", () => {
      it("GET devuelve el estado del colaborador", async () => {
        const { customer, rut } = await colaborador();

        const res = await api.get(`/admin/colaboradores/${customer.id}`, adminHeaders);

        expect(res.data.colaborador).toEqual(
          expect.objectContaining({
            rut,
            enabled: true,
            must_change_password: false,
            locked_until: null,
          })
        );
        expect(JSON.stringify(res.data)).not.toContain("argon2");
      });

      it("GET de un cliente que no es colaborador → 404", async () => {
        const customerModule = getContainer().resolve<ICustomerModuleService>(
          Modules.CUSTOMER
        );
        const otro = await customerModule.createCustomers({ email: "otro@x.cl" });

        expect(
          await status(api.get(`/admin/colaboradores/${otro.id}`, adminHeaders))
        ).toBe(404);
      });

      it("sin sesión de admin → 401", async () => {
        const { customer } = await colaborador();

        expect(await status(api.get(`/admin/colaboradores/${customer.id}`))).toBe(401);
        expect(
          await status(
            api.post(`/admin/colaboradores/${customer.id}/habilitacion`, { enabled: false })
          )
        ).toBe(401);
      });

      it("POST deshabilita y registra qué admin lo hizo", async () => {
        const { customer } = await colaborador();

        const res = await habilitacion(customer.id, false);

        expect(res.data.colaborador).toEqual(
          expect.objectContaining({
            enabled: false,
            enabled_changed_by: adminUserId,
            enabled_changed_at: expect.any(String),
          })
        );
      });

      it.each([[{ enabled: "no" }], [{}], [{ enabled: false, rut: "1-9" }]])(
        "body inválido %p → 400",
        async (body) => {
          const { customer } = await colaborador();

          expect(
            await status(
              api.post(`/admin/colaboradores/${customer.id}/habilitacion`, body, adminHeaders)
            )
          ).toBe(400);
        }
      );
    });

    describe("efectos de deshabilitar", () => {
      it("con la clave correcta avisa que está deshabilitada; con una incorrecta, mensaje genérico", async () => {
        const { customer, rut } = await colaborador();
        await habilitacion(customer.id, false);

        const correcta = await login(rut, CLAVE_COLABORADOR);
        expect(correcta.status).toBe(401);
        expect(correcta.data.message).toBe(ACCOUNT_DISABLED_MESSAGE);

        const incorrecta = await login(rut, "ClaveEquivocada");
        expect(incorrecta.status).toBe(401);
        expect(incorrecta.data.message).toBe(INVALID_CREDENTIALS_MESSAGE);
      });

      it("bloqueada por intentos: mensaje genérico aun con la clave correcta", async () => {
        const { customer, rut } = await colaborador();
        await habilitacion(customer.id, false);
        for (let i = 0; i < LOCKOUT.maxFailedAttempts; i++) {
          await login(rut, "ClaveEquivocada");
        }

        const res = await login(rut, CLAVE_COLABORADOR);
        expect(res.data.message).toBe(INVALID_CREDENTIALS_MESSAGE);
      });

      it.each([
        ["GET", "/store/customers/me"],
        ["GET", "/store/customers/me/password"],
        ["GET", "/store/benefit-budget"],
        ["POST", "/store/carts"],
      ])("la sesión abierta recibe 401 account_disabled en %s %s", async (method, path) => {
        const { customer, token } = await colaborador();
        const headers = { headers: { ...pk, Authorization: `Bearer ${token}` } };

        await habilitacion(customer.id, false);

        const res = await errorOf(
          method === "GET" ? api.get(path, headers) : api.post(path, {}, headers)
        );
        expect(res.status).toBe(401);
        expect(res.data.code).toBe("account_disabled");
      });

      it("no se envía el correo de recuperación", async () => {
        const { customer, rut } = await colaborador();
        await habilitacion(customer.id, false);

        expect(
          await status(api.post("/auth/customer/rut/reset-password", { identifier: rut }))
        ).toBe(201);

        await new Promise((r) => setTimeout(r, 1000));
        const notifications = getContainer().resolve<INotificationModuleService>(
          Modules.NOTIFICATION
        );
        expect(await notifications.listNotifications({})).toHaveLength(0);
      });

      it("habilitar de nuevo devuelve el acceso con la misma clave", async () => {
        const { customer, rut, token } = await colaborador();
        await habilitacion(customer.id, false);
        await habilitacion(customer.id, true);

        expect((await login(rut, CLAVE_COLABORADOR)).status).toBe(200);
        expect(
          await status(
            api.get("/store/customers/me", {
              headers: { ...pk, Authorization: `Bearer ${token}` },
            })
          )
        ).toBe(200);
      });
    });

    describe("workflow", () => {
      it("acepta el RUT en cualquier formato", async () => {
        const { rut } = await colaborador();
        const conPuntos = `${rut.slice(0, 2)}.${rut.slice(2, 5)}.${rut.slice(5)}`;

        const { result } = await setColaboradorEnabledWorkflow(getContainer()).run({
          input: { rut: conPuntos, enabled: false },
        });

        expect(result.rut).toBe(rut);
        expect(result.enabled).toBe(false);
      });

      it("RUT inexistente o inválido → error", async () => {
        await expectFails(
          setColaboradorEnabledWorkflow(getContainer()).run({
            input: { rut: "11.111.111-1", enabled: false },
          }),
          /No hay un colaborador/
        );
        await expectFails(
          setColaboradorEnabledWorkflow(getContainer()).run({
            input: { rut: "12.345.678-4", enabled: false },
          }),
          /RUT inválido/
        );
      });
    });
  },
});
