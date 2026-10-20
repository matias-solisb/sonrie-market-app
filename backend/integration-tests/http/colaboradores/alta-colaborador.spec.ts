import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { IAuthModuleService } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import {
  ensureSonrieCompany,
  findSonrieCompany,
} from "../../../src/utils/sonrie-company";
import { createColaboradorWorkflow } from "../../../src/workflows/colaborador/workflows";
import { generatePublishableKey, generateStoreHeaders } from "../../utils/store";

jest.setTimeout(60 * 1000);

/*

Alta de colaborador (npm run test:integration:http).

Camino feliz
- La company única se crea una vez (idempotente).
- El alta deja customer + identidad `rut` + employee no admin de esa company;
  el colaborador entra con RUT + clave inicial (últimos 4 dígitos) y ve su
  employee en /store/customers/me.
- La identidad queda con must_change_password = true.

Errores comunes de quien da de alta (en todos: error y nada creado)
- RUT repetido, también escrito en otro formato.
- RUT inválido (DV incorrecto, formato) o vacío.
- Correo repetido con otro RUT, también con otras mayúsculas o espacios.
- Correo con formato inválido.
- Nombre o apellido vacíos.
- Company inexistente (falla el último paso: se revierte todo).

Errores comunes del colaborador
- Login con clave incorrecta → 401.
- emailpass ya no sirve para un customer.
- Identidad sin customer vinculado → /store/customers/me 401.
- Autorregistro por la API (sin pasar por el alta) → 403.

*/

const COLABORADOR = {
  rut: "12.345.678-5",
  email: "juana.perez@sonriemarket.cl",
  first_name: "Juana",
  last_name: "Pérez",
};
const RUT_NORMALIZADO = "12345678-5";
const CLAVE_INICIAL = "5678";
const OTRO_RUT = "11.111.111-1";

const credenciales = { rut: COLABORADOR.rut, password: CLAVE_INICIAL };

const status = (p: Promise<any>) =>
  p.then((r) => r.status).catch((e) => e.response?.status);

/*
Los workflows de Medusa rechazan con un objeto plano ({ message, type, … }),
no con una instancia de Error (el motor serializa el error), así que
`rejects.toThrow()` no sirve: dice "did not throw" aunque el workflow falle.
*/
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
    let storeHeaders: any;
    let companyId: string;

    beforeEach(async () => {
      const container = getContainer();
      const publishableKey = await generatePublishableKey(container);
      storeHeaders = generateStoreHeaders({ publishableKey }).headers;
      companyId = (await ensureSonrieCompany(container)).company.id;
    });

    const alta = (overrides: Record<string, any> = {}) =>
      createColaboradorWorkflow(getContainer()).run({
        input: { company_id: companyId, ...COLABORADOR, ...overrides },
      });

    const count = async (entity: string, filters: Record<string, any>) => {
      const query = getContainer().resolve(ContainerRegistrationKeys.QUERY);
      const { data } = await query.graph({ entity, fields: ["id"], filters });
      return data.length;
    };

    /** Nada quedó creado: ni customers, ni identidades, ni employees. */
    const expectNothingCreated = async () => {
      expect(await count("customer", {})).toBe(0);
      expect(await count("provider_identity", {})).toBe(0);
      expect(await count("employee", {})).toBe(0);
    };

    describe("company única", () => {
      it("se crea una sola vez", async () => {
        const again = await ensureSonrieCompany(getContainer());

        expect(again.created).toBe(false);
        expect(again.company.id).toBe(companyId);
        expect((await findSonrieCompany(getContainer()))?.id).toBe(companyId);
      });
    });

    describe("alta correcta", () => {
      it("crea customer, identidad rut y employee no admin; el colaborador se loguea", async () => {
        const { result } = await alta();

        expect(result.customer.email).toBe(COLABORADOR.email);
        expect(result.customer.has_account).toBe(true);
        expect(result.employee.company.id).toBe(companyId);

        const login = await api.post("/auth/customer/rut", credenciales);

        const me = await api.get(
          "/store/customers/me?fields=*employee,*employee.company",
          { headers: { ...storeHeaders, Authorization: `Bearer ${login.data.token}` } }
        );

        expect(me.status).toBe(200);
        expect(me.data.customer.id).toBe(result.customer.id);
        expect(me.data.customer.employee.is_admin).toBe(false);
        expect(me.data.customer.employee.company.id).toBe(companyId);
      });

      it("la identidad es el RUT normalizado y queda pendiente el cambio de clave", async () => {
        const { result } = await alta();

        const authModule = getContainer().resolve<IAuthModuleService>(Modules.AUTH);
        const [pi] = await authModule.listProviderIdentities({ provider: "rut" });

        expect(pi.entity_id).toBe(RUT_NORMALIZADO);
        expect(pi.provider_metadata?.must_change_password).toBe(true);

        const identity = await authModule.retrieveAuthIdentity(pi.auth_identity_id!);
        expect(identity.app_metadata?.customer_id).toBe(result.customer.id);
        // Ninguna identidad emailpass para colaboradores
        expect(await count("provider_identity", { provider: "emailpass" })).toBe(0);
      });

      it("normaliza el correo: mayúsculas y espacios no cambian la cuenta", async () => {
        const { result } = await alta({ email: "  Juana.Perez@SonrieMarket.cl " });

        expect(result.customer.email).toBe(COLABORADOR.email);
      });

      it("acepta el RUT en cualquier formato", async () => {
        await alta({ rut: "12345678-5" });

        const login = await api.post("/auth/customer/rut", {
          rut: "12.345.678-5",
          password: CLAVE_INICIAL,
        });
        expect(login.status).toBe(200);
      });
    });

    describe("errores al dar de alta", () => {
      it("RUT repetido: falla y no crea un segundo customer", async () => {
        await alta();

        await expectFails(alta({ email: "otra@sonriemarket.cl" }));

        expect(await count("customer", {})).toBe(1);
        expect(await count("employee", {})).toBe(1);
        expect(await count("provider_identity", { provider: "rut" })).toBe(1);
      });

      it("RUT repetido escrito en otro formato: también falla", async () => {
        await alta();

        await expectFails(alta({ rut: "123456785", email: "otra@sonriemarket.cl" }));

        expect(await count("customer", {})).toBe(1);
      });

      it.each([
        ["DV incorrecto", "12.345.678-4"],
        ["letras", "12.3a5.678-5"],
        ["demasiado corto", "1-9"],
        ["vacío", ""],
      ])("RUT inválido (%s): falla sin crear nada", async (_caso, rut) => {
        await expectFails(alta({ rut }), /RUT inválido/);
        await expectNothingCreated();
      });

      it("correo repetido con otro RUT: falla y revierte la identidad", async () => {
        await alta();

        await expectFails(alta({ rut: OTRO_RUT }));

        expect(await count("customer", {})).toBe(1);
        expect(await count("provider_identity", { provider: "rut" })).toBe(1);
      });

      it("correo repetido con otras mayúsculas o espacios: también falla", async () => {
        await alta();

        await expectFails(alta({ rut: OTRO_RUT, email: " JUANA.PEREZ@sonriemarket.cl" }));

        expect(await count("customer", {})).toBe(1);
        expect(await count("provider_identity", { provider: "rut" })).toBe(1);
      });

      it.each([
        ["sin arroba", "juana.perez"],
        ["sin dominio", "juana@"],
        ["con espacios dentro", "juana perez@sonriemarket.cl"],
        ["vacío", ""],
      ])("correo inválido (%s): falla sin crear nada", async (_caso, email) => {
        await expectFails(alta({ email }), /correo inválido/);
        await expectNothingCreated();
      });

      it("nombre o apellido vacíos: falla sin crear nada", async () => {
        await expectFails(alta({ first_name: "  " }), /falta el nombre/);
        await expectFails(alta({ last_name: "" }), /falta el apellido/);
        await expectNothingCreated();
      });

      it("junta todos los errores en un solo mensaje", async () => {
        await expectFails(
          alta({ rut: "1", email: "x", first_name: "", last_name: "" }),
          /RUT inválido.*correo inválido.*falta el nombre.*falta el apellido/
        );
      });

      it("company inexistente: revierte la identidad y el customer", async () => {
        await expectFails(alta({ company_id: "comp_no_existe" }));
        await expectNothingCreated();
      });
    });

    describe("errores del colaborador", () => {
      it("login con clave incorrecta → 401", async () => {
        await alta();

        const code = await status(
          api.post("/auth/customer/rut", { rut: COLABORADOR.rut, password: "0000" })
        );

        expect(code).toBe(401);
      });

      it("login con un RUT que no existe → 401", async () => {
        const code = await status(
          api.post("/auth/customer/rut", { rut: OTRO_RUT, password: "1111" })
        );

        expect(code).toBe(401);
      });

      it("emailpass con el correo del colaborador no sirve (no tiene esa identidad)", async () => {
        await alta();

        const code = await status(
          api.post("/auth/customer/emailpass", {
            email: COLABORADOR.email,
            password: CLAVE_INICIAL,
          })
        );

        expect(code).toBeGreaterThanOrEqual(400);
        expect(code).toBeLessThan(500);
      });

      it("identidad sin customer vinculado: /store/customers/me → 401", async () => {
        // El caso del documento de dev: la identidad existe, pero el paso que
        // crea el customer no corrió. El login "funciona" y la cuenta no.
        const authModule = getContainer().resolve<IAuthModuleService>(Modules.AUTH);
        await authModule.register("rut", { body: { rut: COLABORADOR.rut } });

        const login = await api.post("/auth/customer/rut", credenciales);

        const code = await status(
          api.get("/store/customers/me", {
            headers: { ...storeHeaders, Authorization: `Bearer ${login.data.token}` },
          })
        );

        expect(code).toBe(401);
      });
    });

    describe("autorregistro por API: bloqueado", () => {
      it("POST /auth/customer/rut/register → 403 y no crea la identidad", async () => {
        const code = await status(
          api.post("/auth/customer/rut/register", { rut: COLABORADOR.rut })
        );

        expect(code).toBe(403);
        expect(await count("provider_identity", {})).toBe(0);
      });

      it("el bloqueo vale para cualquier provider (también emailpass)", async () => {
        const code = await status(
          api.post("/auth/customer/emailpass/register", {
            email: COLABORADOR.email,
            password: "ClaveDePrueba1",
          })
        );

        expect(code).toBe(403);
        expect(await count("provider_identity", {})).toBe(0);
      });

      it("POST /store/customers con token de registro → 403 y no crea el customer", async () => {
        // Aunque alguien consiga un token de registro (identidad sin customer),
        // no puede crearse el customer.
        const authModule = getContainer().resolve<IAuthModuleService>(Modules.AUTH);
        await authModule.register("rut", { body: { rut: COLABORADOR.rut } });
        const login = await api.post("/auth/customer/rut", credenciales);

        const code = await status(
          api.post(
            "/store/customers",
            { email: COLABORADOR.email },
            { headers: { ...storeHeaders, Authorization: `Bearer ${login.data.token}` } }
          )
        );

        expect(code).toBe(403);
        expect(await count("customer", {})).toBe(0);
      });

      it("el login y /store/customers/me siguen funcionando", async () => {
        const { result } = await alta();
        const login = await api.post("/auth/customer/rut", credenciales);

        const me = await api.get("/store/customers/me", {
          headers: { ...storeHeaders, Authorization: `Bearer ${login.data.token}` },
        });

        expect(me.data.customer.id).toBe(result.customer.id);
      });
    });
  },
});
