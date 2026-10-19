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
- El alta deja customer + identidad + employee no admin de esa company, y el
  colaborador se loguea y ve su employee en /store/customers/me.

Errores comunes de quien da de alta (en todos: error y nada creado)
- Correo repetido, también con otras mayúsculas o espacios.
- Correo con formato inválido.
- Clave vacía o corta.
- Nombre o apellido vacíos.
- Company inexistente (falla el último paso: se revierte todo).

Errores comunes del colaborador
- Login con clave incorrecta → 401.
- Identidad sin customer vinculado → /store/customers/me 401.
- Autorregistro por la API (sin pasar por el alta) → 403.

*/

const COLABORADOR = {
  email: "juana.perez@sonriemarket.cl",
  password: "ClaveDePrueba1",
  first_name: "Juana",
  last_name: "Pérez",
};

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
      expect(await count("provider_identity", { provider: "emailpass" })).toBe(0);
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
      it("crea customer, identidad y employee no admin; el colaborador se loguea", async () => {
        const { result } = await alta();

        expect(result.customer.email).toBe(COLABORADOR.email);
        expect(result.customer.has_account).toBe(true);
        expect(result.employee.company.id).toBe(companyId);

        const login = await api.post("/auth/customer/emailpass", {
          email: COLABORADOR.email,
          password: COLABORADOR.password,
        });

        const me = await api.get(
          "/store/customers/me?fields=*employee,*employee.company",
          { headers: { ...storeHeaders, Authorization: `Bearer ${login.data.token}` } }
        );

        expect(me.status).toBe(200);
        expect(me.data.customer.id).toBe(result.customer.id);
        expect(me.data.customer.employee.is_admin).toBe(false);
        expect(me.data.customer.employee.company.id).toBe(companyId);
      });

      it("normaliza el correo: mayúsculas y espacios no cambian la cuenta", async () => {
        const { result } = await alta({ email: "  Juana.Perez@SonrieMarket.cl " });

        expect(result.customer.email).toBe(COLABORADOR.email);

        const login = await api.post("/auth/customer/emailpass", {
          email: COLABORADOR.email,
          password: COLABORADOR.password,
        });
        expect(login.status).toBe(200);
      });
    });

    describe("errores al dar de alta", () => {
      it("correo repetido: falla y no crea un segundo customer", async () => {
        await alta();

        await expectFails(alta());

        expect(await count("customer", { email: COLABORADOR.email })).toBe(1);
        expect(await count("employee", {})).toBe(1);
      });

      it("correo repetido con otras mayúsculas o espacios: también falla", async () => {
        await alta();

        await expectFails(alta({ email: " JUANA.PEREZ@sonriemarket.cl" }));

        expect(await count("customer", {})).toBe(1);
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

      it.each([
        ["vacía", ""],
        ["corta", "1234"],
      ])("clave %s: falla sin crear nada", async (_caso, password) => {
        await expectFails(alta({ password }), /al menos 8 caracteres/);
        await expectNothingCreated();
      });

      it("nombre o apellido vacíos: falla sin crear nada", async () => {
        await expectFails(alta({ first_name: "  " }), /falta el nombre/);
        await expectFails(alta({ last_name: "" }), /falta el apellido/);
        await expectNothingCreated();
      });

      it("junta todos los errores en un solo mensaje", async () => {
        await expectFails(alta({ email: "x", password: "", first_name: "", last_name: "" }), /correo inválido.*clave.*falta el nombre.*falta el apellido/);
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
          api.post("/auth/customer/emailpass", {
            email: COLABORADOR.email,
            password: "otra-clave",
          })
        );

        expect(code).toBe(401);
      });

      it("login con un correo que no existe → 401", async () => {
        const code = await status(
          api.post("/auth/customer/emailpass", {
            email: "nadie@sonriemarket.cl",
            password: COLABORADOR.password,
          })
        );

        expect(code).toBe(401);
      });

      it("identidad sin customer vinculado: /store/customers/me → 401", async () => {
        // El caso del documento de dev: la identidad existe, pero el paso que
        // crea el customer no corrió. El login "funciona" y la cuenta no.
        const authModule = getContainer().resolve<IAuthModuleService>(Modules.AUTH);
        await authModule.register("emailpass", {
          body: { email: COLABORADOR.email, password: COLABORADOR.password },
        });

        const login = await api.post("/auth/customer/emailpass", {
          email: COLABORADOR.email,
          password: COLABORADOR.password,
        });

        const code = await status(
          api.get("/store/customers/me", {
            headers: { ...storeHeaders, Authorization: `Bearer ${login.data.token}` },
          })
        );

        expect(code).toBe(401);
      });
    });

    describe("autorregistro por API: bloqueado", () => {
      it("POST /auth/customer/emailpass/register → 403 y no crea la identidad", async () => {
        const code = await status(
          api.post("/auth/customer/emailpass/register", {
            email: COLABORADOR.email,
            password: COLABORADOR.password,
          })
        );

        expect(code).toBe(403);
        expect(await count("provider_identity", { provider: "emailpass" })).toBe(0);
      });

      it("el bloqueo vale para cualquier provider (también el futuro rut)", async () => {
        const code = await status(
          api.post("/auth/customer/rut/register", {
            rut: "12345678-5",
            password: COLABORADOR.password,
          })
        );

        expect(code).toBe(403);
      });

      it("POST /store/customers con token de registro → 403 y no crea el customer", async () => {
        // Aunque alguien consiga un token de registro (identidad sin customer),
        // no puede crearse el customer.
        const authModule = getContainer().resolve<IAuthModuleService>(Modules.AUTH);
        await authModule.register("emailpass", {
          body: { email: COLABORADOR.email, password: COLABORADOR.password },
        });
        const login = await api.post("/auth/customer/emailpass", {
          email: COLABORADOR.email,
          password: COLABORADOR.password,
        });

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
        const login = await api.post("/auth/customer/emailpass", {
          email: COLABORADOR.email,
          password: COLABORADOR.password,
        });

        const me = await api.get("/store/customers/me", {
          headers: { ...storeHeaders, Authorization: `Bearer ${login.data.token}` },
        });

        expect(me.data.customer.id).toBe(result.customer.id);
      });
    });
  },
});
