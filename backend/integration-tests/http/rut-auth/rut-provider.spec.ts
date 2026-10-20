import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { IAuthModuleService } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";
import { ARGON2_PARAMS, INVALID_CREDENTIALS_MESSAGE } from "../../../src/modules/rut-auth/config";
import { adminHeaders, createAdminUser } from "../../utils/admin";

jest.setTimeout(60 * 1000);

/*

Provider `rut` (rut-auth, paso 3) — npm run test:integration:http.

Se prueba el provider solo, registrando identidades directo en el Auth
Module. El alta completa (customer + employee) está en
colaboradores/alta-colaborador.spec.ts.

- register: entity_id = RUT normalizado, clave inicial = últimos 4 dígitos,
  must_change_password = true, hash argon2id con los parámetros de config.ts,
  nunca devuelve el hash ni acepta una clave elegida.
- login POST /auth/customer/rut: JWT con la clave correcta, cualquier formato
  de RUT; mismo 401 y mismo mensaje para clave mala, RUT inexistente y RUT
  inválido.
- update: cambia la clave y apaga must_change_password.
- Convivencia: emailpass ya no sirve para customer, sí para el Admin.
- La ruta HTTP de registro sigue cerrada.

*/

const RUT = "12.345.678-5";
const RUT_NORMALIZADO = "12345678-5";
const CLAVE_INICIAL = "5678";

const status = (p: Promise<any>) =>
  p.then((r) => r.status).catch((e) => e.response?.status);

const errorOf = (p: Promise<any>) =>
  p.then(
    () => null,
    (e) => e.response
  );

medusaIntegrationTestRunner({
  inApp: true,
  env: { JWT_SECRET: "supersecret" },
  testSuite: ({ api, getContainer }) => {
    const auth = () => getContainer().resolve<IAuthModuleService>(Modules.AUTH);

    const registrar = (body: Record<string, any> = { rut: RUT }) =>
      auth().register("rut", { body });

    const metadataDe = async (entity_id: string) => {
      const [pi] = await auth().listProviderIdentities({
        provider: "rut",
        entity_id,
      });
      return pi?.provider_metadata as Record<string, any> | undefined;
    };

    describe("register", () => {
      it("crea la identidad con el RUT normalizado y el estado inicial", async () => {
        const { success, authIdentity, error } = await registrar();

        expect(error).toBeUndefined();
        expect(success).toBe(true);

        const pi = authIdentity!.provider_identities!.find((p) => p.provider === "rut")!;
        expect(pi.entity_id).toBe(RUT_NORMALIZADO);
        // El hash nunca sale del provider
        expect(pi.provider_metadata?.password_hash).toBeUndefined();

        const metadata = await metadataDe(RUT_NORMALIZADO);
        expect(metadata).toEqual(
          expect.objectContaining({
            failed_attempts: 0,
            locked_until: null,
            must_change_password: true,
            password_changed_at: null,
            enabled: true,
          })
        );
      });

      it("guarda un hash argon2id con los parámetros explícitos, no la clave", async () => {
        await registrar();
        const { password_hash } = (await metadataDe(RUT_NORMALIZADO))!;

        expect(password_hash).toMatch(/^\$argon2id\$v=19\$/);
        expect(password_hash).toContain(
          `m=${ARGON2_PARAMS.memoryCost},t=${ARGON2_PARAMS.timeCost},p=${ARGON2_PARAMS.parallelism}`
        );
        expect(password_hash).not.toContain(CLAVE_INICIAL);
      });

      it("ignora una clave enviada en el body: la inicial la genera la plataforma", async () => {
        await registrar({ rut: RUT, password: "ClaveElegida123" });

        expect(
          await status(api.post("/auth/customer/rut", { rut: RUT, password: "ClaveElegida123" }))
        ).toBe(401);
        expect(
          await status(api.post("/auth/customer/rut", { rut: RUT, password: CLAVE_INICIAL }))
        ).toBe(200);
      });

      it("rechaza un RUT inválido sin crear nada", async () => {
        const { success } = await registrar({ rut: "12.345.678-4" });

        expect(success).toBe(false);
        expect(await auth().listProviderIdentities({ provider: "rut" })).toHaveLength(0);
      });

      it("no duplica: el mismo RUT en otro formato es la misma identidad", async () => {
        await registrar();
        const { success } = await registrar({ rut: "123456785" });

        expect(success).toBe(false);
        expect(await auth().listProviderIdentities({ provider: "rut" })).toHaveLength(1);
      });
    });

    describe("login POST /auth/customer/rut", () => {
      beforeEach(async () => {
        await registrar();
      });

      it.each([RUT, RUT_NORMALIZADO, "123456785", " 12.345.678-5 "])(
        "devuelve un JWT con la clave inicial (RUT escrito como %p)",
        async (rut) => {
          const res = await api.post("/auth/customer/rut", {
            rut,
            password: CLAVE_INICIAL,
          });

          expect(res.status).toBe(200);
          expect(typeof res.data.token).toBe("string");
          expect(JSON.stringify(res.data)).not.toContain("argon2");
        }
      );

      it.each([
        ["clave incorrecta", { rut: RUT, password: "0000" }],
        ["RUT inexistente", { rut: "11.111.111-1", password: "1111" }],
        ["RUT inválido", { rut: "12.345.678-4", password: CLAVE_INICIAL }],
        ["sin clave", { rut: RUT }],
        ["sin RUT", { password: CLAVE_INICIAL }],
      ])("%s → 401 con el mismo mensaje", async (_caso, body) => {
        const res = await errorOf(api.post("/auth/customer/rut", body));

        expect(res.status).toBe(401);
        expect(res.data.message).toBe(INVALID_CREDENTIALS_MESSAGE);
      });
    });

    describe("update (cambio de clave)", () => {
      beforeEach(async () => {
        await registrar();
      });

      it("cambia la clave, apaga must_change_password y registra la fecha", async () => {
        const { success, error } = await auth().updateProvider("rut", {
          entity_id: RUT_NORMALIZADO,
          password: "ClaveNueva2026",
        });

        expect(error).toBeUndefined();
        expect(success).toBe(true);

        const metadata = (await metadataDe(RUT_NORMALIZADO))!;
        expect(metadata.must_change_password).toBe(false);
        expect(metadata.password_changed_at).toEqual(expect.any(String));

        expect(
          await status(api.post("/auth/customer/rut", { rut: RUT, password: CLAVE_INICIAL }))
        ).toBe(401);
        expect(
          await status(api.post("/auth/customer/rut", { rut: RUT, password: "ClaveNueva2026" }))
        ).toBe(200);
      });

      it("rechaza una clave más corta que el mínimo y no cambia nada", async () => {
        const { success } = await auth().updateProvider("rut", {
          entity_id: RUT_NORMALIZADO,
          password: "corta",
        });

        expect(success).toBe(false);
        expect((await metadataDe(RUT_NORMALIZADO))!.must_change_password).toBe(true);
        expect(
          await status(api.post("/auth/customer/rut", { rut: RUT, password: CLAVE_INICIAL }))
        ).toBe(200);
      });
    });

    describe("convivencia con emailpass", () => {
      it("emailpass ya no sirve para un customer, aunque la identidad exista", async () => {
        await auth().register("emailpass", {
          body: { email: "juana@sonriemarket.cl", password: "ClaveDePrueba1" },
        });

        const code = await status(
          api.post("/auth/customer/emailpass", {
            email: "juana@sonriemarket.cl",
            password: "ClaveDePrueba1",
          })
        );

        expect(code).toBeGreaterThanOrEqual(400);
        expect(code).toBeLessThan(500);
      });

      it("el Admin sigue entrando con emailpass", async () => {
        await createAdminUser(adminHeaders, getContainer());

        const res = await api.post("/auth/user/emailpass", {
          email: "admin@medusa.js",
          password: "somepassword",
        });

        expect(res.status).toBe(200);
        expect(typeof res.data.token).toBe("string");
      });

      it("un admin no puede entrar por el provider rut", async () => {
        await registrar();

        const code = await status(
          api.post("/auth/user/rut", { rut: RUT, password: CLAVE_INICIAL })
        );

        expect(code).toBeGreaterThanOrEqual(400);
        expect(code).toBeLessThan(500);
      });
    });

    describe("registro por HTTP", () => {
      it("POST /auth/customer/rut/register sigue cerrado (403)", async () => {
        expect(
          await status(api.post("/auth/customer/rut/register", { rut: RUT }))
        ).toBe(403);
        expect(await auth().listProviderIdentities({ provider: "rut" })).toHaveLength(0);
      });
    });
  },
});
