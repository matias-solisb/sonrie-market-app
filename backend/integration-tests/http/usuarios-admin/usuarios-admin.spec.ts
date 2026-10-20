import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import {
  adminHeaders,
  createAdminUser,
  createColaboradorSession,
} from "../../utils/admin";
import { generatePublishableKey, generateStoreHeaders } from "../../utils/store";

jest.setTimeout(60 * 1000);

/*

Usuarios del Admin de Medusa (backoffice) (npm run test:integration:http).

Se crean con el flujo nativo de Medusa v2, sin código propio:
  1. un admin invita:            POST /admin/invites               → invite.token
  2. la persona crea su clave:   POST /auth/user/emailpass/register → token de registro
  3. acepta la invitación:       POST /admin/invites/accept?token=… (con el token de registro)

Interino: en el MVP el backoffice entrará con SSO de Entra
(estimacion-sso-entra-backoffice.md). Estos tests cubren el login local que
existe hoy y que quedará como break-glass.

Errores comunes cubiertos: invitar sin sesión, invitar con la sesión de un
colaborador, invitar a un correo que ya es admin o ya invitado, aceptar con
un token inválido, aceptar estando logueado, login con clave incorrecta, y
un colaborador intentando entrar al Admin.

*/

const NUEVO = { email: "operador@sonriemarket.cl", password: "ClaveDeAdmin1" };

const status = (p: Promise<any>) =>
  p.then((r) => r.status).catch((e) => e.response?.status);

medusaIntegrationTestRunner({
  inApp: true,
  env: { JWT_SECRET: "supersecret" },
  testSuite: ({ api, getContainer }) => {
    beforeEach(async () => {
      await createAdminUser(adminHeaders, getContainer());
    });

    const invite = async (email = NUEVO.email) =>
      (await api.post("/admin/invites", { email }, adminHeaders)).data.invite;

    const registerToken = async () =>
      (await api.post("/auth/user/emailpass/register", NUEVO)).data.token;

    const accept = (inviteToken: string, token: string) =>
      api.post(
        `/admin/invites/accept?token=${inviteToken}`,
        { email: NUEVO.email, first_name: "Olga", last_name: "Operadora" },
        { headers: { Authorization: `Bearer ${token}` } }
      );

    const countUsers = async (email: string) => {
      const query = getContainer().resolve(ContainerRegistrationKeys.QUERY);
      const { data } = await query.graph({
        entity: "user",
        fields: ["id"],
        filters: { email },
      });
      return data.length;
    };

    describe("alta correcta", () => {
      it("invitación → registro → aceptación → el nuevo admin entra al Admin", async () => {
        const inv = await invite();
        const res = await accept(inv.token, await registerToken());

        expect(res.status).toBe(200);
        expect(res.data.user.email).toBe(NUEVO.email);

        const login = await api.post("/auth/user/emailpass", NUEVO);
        const me = await api.get("/admin/users/me", {
          headers: { Authorization: `Bearer ${login.data.token}` },
        });

        expect(me.status).toBe(200);
        expect(me.data.user.email).toBe(NUEVO.email);
      });
    });

    describe("errores al invitar", () => {
      it("sin sesión de admin → 401", async () => {
        const code = await status(api.post("/admin/invites", { email: NUEVO.email }));
        expect(code).toBe(401);
      });

      it("con la sesión de un colaborador → 401", async () => {
        const container = getContainer();
        const publishableKey = await generatePublishableKey(container);
        const { token } = await createColaboradorSession({
          api,
          container,
          email: "juana.perez@sonriemarket.cl",
        });

        const code = await status(
          api.post(
            "/admin/invites",
            { email: NUEVO.email },
            {
              headers: {
                ...generateStoreHeaders({ publishableKey }).headers,
                Authorization: `Bearer ${token}`,
              },
            }
          )
        );

        expect(code).toBe(401);
      });

      it("a un correo que ya es admin → 400", async () => {
        const code = await status(
          api.post("/admin/invites", { email: "admin@medusa.js" }, adminHeaders)
        );
        expect(code).toBe(400);
      });

      it("dos veces al mismo correo → la segunda falla", async () => {
        await invite();
        const code = await status(
          api.post("/admin/invites", { email: NUEVO.email }, adminHeaders)
        );
        expect(code).toBeGreaterThanOrEqual(400);
      });

      it("con un correo inválido → 400", async () => {
        const code = await status(
          api.post("/admin/invites", { email: "operador@" }, adminHeaders)
        );
        expect(code).toBe(400);
      });
    });

    describe("errores al aceptar", () => {
      it("token de invitación inválido → 401 y no crea el usuario", async () => {
        await invite();
        const code = await status(accept("token-invalido", await registerToken()));

        expect(code).toBe(401);
        expect(await countUsers(NUEVO.email)).toBe(0);
      });

      it("sin token de registro → 401", async () => {
        const inv = await invite();
        const code = await status(
          api.post(
            `/admin/invites/accept?token=${inv.token}`,
            { email: NUEVO.email, first_name: "Olga", last_name: "Operadora" }
          )
        );

        expect(code).toBe(401);
        expect(await countUsers(NUEVO.email)).toBe(0);
      });

      it("estando logueado como otro admin → error y no crea el usuario", async () => {
        const inv = await invite();
        const code = await status(
          api.post(
            `/admin/invites/accept?token=${inv.token}`,
            { email: NUEVO.email, first_name: "Olga", last_name: "Operadora" },
            adminHeaders
          )
        );

        expect(code).toBeGreaterThanOrEqual(400);
        expect(await countUsers(NUEVO.email)).toBe(0);
      });
    });

    describe("errores al entrar", () => {
      it("login con clave incorrecta → 401", async () => {
        const inv = await invite();
        await accept(inv.token, await registerToken());

        const code = await status(
          api.post("/auth/user/emailpass", { email: NUEVO.email, password: "otra-clave" })
        );
        expect(code).toBe(401);
      });

      it("un colaborador no entra al Admin con su token → 401", async () => {
        const { token } = await createColaboradorSession({
          api,
          container: getContainer(),
          email: "juana.perez@sonriemarket.cl",
        });

        const code = await status(
          api.get("/admin/users/me", { headers: { Authorization: `Bearer ${token}` } })
        );
        expect(code).toBe(401);
      });

      it("las credenciales de un colaborador no dan acceso al Admin", async () => {
        // Los colaboradores entran con RUT + clave (provider `rut`), que no
        // está habilitado para el actor `user` (authMethodsPerActor), y no
        // tienen identidad emailpass.
        const { rut, password } = await createColaboradorSession({
          api,
          container: getContainer(),
          email: "juana.perez@sonriemarket.cl",
        });

        const porRut = await status(api.post("/auth/user/rut", { rut, password }));
        expect(porRut).toBeGreaterThanOrEqual(400);
        expect(porRut).toBeLessThan(500);

        const porCorreo = await status(
          api.post("/auth/user/emailpass", {
            email: "juana.perez@sonriemarket.cl",
            password,
          })
        );
        expect(porCorreo).toBe(401);
      });
    });
  },
});
