import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import {
  IAuthModuleService,
  INotificationModuleService,
} from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";
import { LOCKOUT } from "../../../src/modules/rut-auth/config";
import { CLAVE_COLABORADOR, createColaboradorSession } from "../../utils/admin";

jest.setTimeout(120 * 1000);

/*

Recuperación de contraseña por correo (rut-auth, paso 8) —
npm run test:integration:http.

- POST /auth/customer/rut/reset-password con el RUT en cualquier formato →
  201 y una notificación al correo del customer con el enlace.
- RUT inexistente o inválido → el mismo 201 y ninguna notificación.
- Con el token del enlace: POST /auth/customer/rut/update cambia la clave;
  la anterior deja de servir, la nueva entra.
- El token es de un solo uso: reusarlo → 401.
- El reset desbloquea una cuenta bloqueada por intentos y deja de pedir el
  cambio de clave inicial.
- Una clave que no cumple la política → 401 Y EL TOKEN SE CONSUME (lo hace el
  core antes de llamar al provider). Por eso el storefront valida la política
  antes de enviar.

*/

const status = (p: Promise<any>) =>
  p.then((r) => r.status).catch((e) => e.response?.status);

const EMAIL = "juana.perez@sonriemarket.cl";

medusaIntegrationTestRunner({
  inApp: true,
  env: { JWT_SECRET: "supersecret" },
  testSuite: ({ api, getContainer }) => {
    const notifications = () =>
      getContainer().resolve<INotificationModuleService>(Modules.NOTIFICATION);

    const colaborador = (cambiarClave = true) =>
      createColaboradorSession({
        api,
        container: getContainer(),
        email: EMAIL,
        cambiarClave,
      });

    const pedirReset = (identifier: string) =>
      status(api.post("/auth/customer/rut/reset-password", { identifier }));

    /** Espera la notificación que crea el subscriber (el evento es asíncrono). */
    const esperarNotificacion = async (to: string, previas = 0) => {
      for (let i = 0; i < 50; i++) {
        const list = await notifications().listNotifications({ to });
        if (list.length > previas) {
          return list.sort((a, b) =>
            String(a.created_at).localeCompare(String(b.created_at))
          )[list.length - 1];
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      throw new Error(`No llegó la notificación a ${to}`);
    };

    const tokenDe = (notification: any) => {
      const url = new URL(notification.data.reset_url);
      return url.searchParams.get("token")!;
    };

    const actualizar = (token: string, password: string) =>
      status(
        api.post(
          "/auth/customer/rut/update",
          { password },
          { headers: { Authorization: `Bearer ${token}` } }
        )
      );

    const login = (rut: string, password: string) =>
      status(api.post("/auth/customer/rut", { rut, password }));

    describe("solicitud", () => {
      it.each(["12.345.678-5", "12345678-5", "123456785", " 12.345.678-5 "])(
        "con el RUT escrito como %p envía el enlace al correo del colaborador",
        async (identifier) => {
          await createColaboradorSession({
            api,
            container: getContainer(),
            email: EMAIL,
            rut: "12.345.678-5",
          });

          expect(await pedirReset(identifier)).toBe(201);

          const n = await esperarNotificacion(EMAIL);
          expect(n.channel).toBe("email");
          expect(n.template).toBe("password-reset");
          expect(n.data?.reset_url).toMatch(/\/cl\/reset-password\?token=/);
        }
      );

      it.each([
        ["inexistente", "11.111.111-1"],
        ["inválido", "12.345.678-4"],
        ["un correo", EMAIL],
      ])("RUT %s → el mismo 201 y ninguna notificación", async (_caso, identifier) => {
        await colaborador();

        expect(await pedirReset(identifier)).toBe(201);

        await new Promise((r) => setTimeout(r, 1000));
        expect(await notifications().listNotifications({})).toHaveLength(0);
      });
    });

    describe("uso del enlace", () => {
      it("cambia la clave: la anterior deja de servir y la nueva entra", async () => {
        const { rut } = await colaborador();
        await pedirReset(rut);
        const token = tokenDe(await esperarNotificacion(EMAIL));

        expect(await actualizar(token, "ClaveRecuperada")).toBe(200);

        expect(await login(rut, CLAVE_COLABORADOR)).toBe(401);
        expect(await login(rut, "ClaveRecuperada")).toBe(200);
      });

      it("el enlace es de un solo uso", async () => {
        const { rut } = await colaborador();
        await pedirReset(rut);
        const token = tokenDe(await esperarNotificacion(EMAIL));

        expect(await actualizar(token, "ClaveRecuperada")).toBe(200);
        expect(await actualizar(token, "OtraClaveMas")).toBe(401);
        expect(await login(rut, "ClaveRecuperada")).toBe(200);
      });

      it("un enlace nuevo invalida el anterior", async () => {
        const { rut } = await colaborador();
        await pedirReset(rut);
        const primero = tokenDe(await esperarNotificacion(EMAIL));
        await pedirReset(rut);
        const segundo = tokenDe(await esperarNotificacion(EMAIL, 1));

        expect(await actualizar(primero, "ClaveRecuperada")).toBe(401);
        expect(await actualizar(segundo, "ClaveRecuperada")).toBe(200);
      });

      it("desbloquea una cuenta bloqueada por intentos fallidos", async () => {
        const { rut } = await colaborador();
        for (let i = 0; i < LOCKOUT.maxFailedAttempts; i++) {
          await login(rut, "ClaveEquivocada");
        }
        expect(await login(rut, CLAVE_COLABORADOR)).toBe(401);

        await pedirReset(rut);
        const token = tokenDe(await esperarNotificacion(EMAIL));
        expect(await actualizar(token, "ClaveRecuperada")).toBe(200);

        expect(await login(rut, "ClaveRecuperada")).toBe(200);
      });

      it("con la clave inicial pendiente, el reset deja de pedir el cambio", async () => {
        const { rut } = await colaborador(false);
        await pedirReset(rut);
        const token = tokenDe(await esperarNotificacion(EMAIL));

        expect(await actualizar(token, "ClaveRecuperada")).toBe(200);

        const auth = getContainer().resolve<IAuthModuleService>(Modules.AUTH);
        const [pi] = await auth.listProviderIdentities({ provider: "rut", entity_id: rut });
        expect(pi.provider_metadata?.must_change_password).toBe(false);
      });

      it("una clave que no cumple la política → 401 y el enlace queda consumido", async () => {
        const { rut, password: inicial } = await colaborador(false);
        await pedirReset(rut);
        const token = tokenDe(await esperarNotificacion(EMAIL));

        expect(await actualizar(token, `Soprole-${inicial}`)).toBe(401);
        expect(await actualizar(token, "ClaveRecuperada")).toBe(401);
      });
    });
  },
});
