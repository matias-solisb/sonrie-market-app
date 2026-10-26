import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { IAuthModuleService } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { createCustomerAccountWorkflow } from "@medusajs/medusa/core-flows";
import { altaColaborador } from "../../../src/utils/colaborador-alta";
import { findSonrieCompany } from "../../../src/utils/sonrie-company";
import { adminHeaders, createAdminUser } from "../../utils/admin";

jest.setTimeout(120 * 1000);

/*

Alta de colaborador desde el Admin (npm run test:integration:http).

POST /admin/colaboradores
- 201: crea customer + identidad rut + employee de la company única (la crea
  si falta); customer.metadata.origen = "manual"; el colaborador entra con
  RUT + clave inicial; evento auth.alta sin RUT ni correo.
- 409: RUT ya colaborador (también en otro formato); nada nuevo.
- 200: RUT con cuenta pero sin employee → solo se vincula.
- Borrar el employee (Companies → Employees) quita el link employee-customer:
  el alta siguiente lo vuelve a vincular. Con otro company_id no borra nada.
- 400: RUT con DV malo, correo inválido, campos de más / faltantes.
- 400: correo ya usado por otro RUT; el workflow revierte (nada a medias).
- 401: sin sesión de admin.

Bloqueos
- POST /admin/customers (el "Crear" del core) → 403.
- POST /admin/customers/:id (editar) sigue funcionando.

Util (misma lógica que el script): ya_existe / vinculado sin HTTP.

*/

const BODY = {
  rut: "12.345.678-5",
  email: "juana.perez@sonriemarket.cl",
  first_name: "Juana",
  last_name: "Pérez Soto",
};
const RUT_NORMALIZADO = "12345678-5";
const CLAVE_INICIAL = "5678";

const errorOf = (p: Promise<any>) =>
  p.then(
    () => null,
    (e) => e.response
  );

medusaIntegrationTestRunner({
  inApp: true,
  env: { JWT_SECRET: "supersecret" },
  testSuite: ({ api, getContainer }) => {
    let lines: string[] = [];
    let spy: jest.SpyInstance;

    beforeEach(async () => {
      await createAdminUser(adminHeaders, getContainer());
      lines = [];
      const logger = getContainer().resolve(ContainerRegistrationKeys.LOGGER);
      spy = jest.spyOn(logger, "info").mockImplementation((msg: any) => {
        lines.push(String(msg));
        return undefined as any;
      });
    });

    afterEach(() => spy.mockRestore());

    const alta = (body: Record<string, any> = BODY) =>
      api.post("/admin/colaboradores", body, adminHeaders);

    const count = async (entity: string, filters: Record<string, any> = {}) => {
      const query = getContainer().resolve(ContainerRegistrationKeys.QUERY);
      const { data } = await query.graph({ entity, fields: ["id"], filters });
      return data.length;
    };

    const altas = () =>
      lines
        .filter((l) => l.startsWith('{"evento":"auth.alta"'))
        .map((l) => JSON.parse(l));

    describe("POST /admin/colaboradores", () => {
      it("201: crea la cuenta completa y el colaborador entra con la clave inicial", async () => {
        const res = await alta();

        expect(res.status).toBe(201);
        expect(res.data.colaborador.status).toBe("creado");

        const customerId = res.data.colaborador.customer_id;
        const query = getContainer().resolve(ContainerRegistrationKeys.QUERY);
        const {
          data: [customer],
        } = await query.graph({
          entity: "customer",
          fields: ["id", "email", "has_account", "metadata", "employee.id", "employee.is_admin", "employee.company.id"],
          filters: { id: customerId },
        });

        const company = await findSonrieCompany(getContainer());
        expect(customer.email).toBe(BODY.email);
        expect(customer.has_account).toBe(true);
        expect(customer.metadata?.origen).toBe("manual");
        expect(customer.employee?.is_admin).toBe(false);
        expect(customer.employee?.company?.id).toBe(company?.id);

        const login = await api.post("/auth/customer/rut", {
          rut: BODY.rut,
          password: CLAVE_INICIAL,
        });
        expect(login.status).toBe(200);
        expect(login.data.token).toBeTruthy();
      });

      it("deja auth.alta con el admin y sin RUT ni correo", async () => {
        const res = await alta();
        const [evento] = altas();

        expect(evento).toMatchObject({
          customer_id: res.data.colaborador.customer_id,
          resultado: "creado",
          origen: "manual",
        });
        expect(evento.actor_id).toBeTruthy();

        const raw = lines.find((l) => l.startsWith('{"evento":"auth.alta"'))!;
        expect(raw).not.toContain(RUT_NORMALIZADO);
        expect(raw).not.toContain("12.345.678");
        expect(raw).not.toContain(BODY.email);
      });

      it("409: el RUT ya es colaborador, aunque venga en otro formato", async () => {
        await alta();
        const res = await errorOf(alta({ ...BODY, rut: "123456785", email: "otra@sonriemarket.cl" }));

        expect(res.status).toBe(409);
        expect(await count("customer")).toBe(1);
        expect(altas()).toHaveLength(1);
      });

      it("200: RUT con cuenta pero sin employee → solo se vincula", async () => {
        // Customer "de antes" (como los creados con curl): identidad rut +
        // customer, sin employee.
        const authModule = getContainer().resolve<IAuthModuleService>(Modules.AUTH);
        const { authIdentity } = await authModule.register("rut", { body: { rut: BODY.rut } });
        const {
          result: customer,
        } = await createCustomerAccountWorkflow(getContainer()).run({
          input: {
            authIdentityId: authIdentity!.id,
            customerData: { email: BODY.email, first_name: BODY.first_name, last_name: BODY.last_name },
          },
        });
        expect(await count("employee")).toBe(0);

        const res = await alta();
        expect(res.status).toBe(200);
        expect(res.data.colaborador).toMatchObject({ status: "vinculado", customer_id: customer.id });
        expect(await count("employee")).toBe(1);
        expect(await count("customer")).toBe(1);
      });

      it("borrar el employee quita el vínculo; el alta lo vuelve a vincular", async () => {
        const created = await alta();
        const customerId = created.data.colaborador.customer_id;
        const companyId = (await findSonrieCompany(getContainer()))!.id;

        await api.delete(
          `/admin/companies/${companyId}/employees/${created.data.colaborador.employee_id}`,
          adminHeaders
        );

        const query = getContainer().resolve(ContainerRegistrationKeys.QUERY);
        const {
          data: [c],
        } = await query.graph({ entity: "customer", fields: ["id", "employee.id"], filters: { id: customerId } });
        expect(c.employee).toBeFalsy();

        const res = await alta();
        expect(res.status).toBe(200);
        expect(res.data.colaborador).toMatchObject({ status: "vinculado", customer_id: customerId });
        expect(res.data.colaborador.employee_id).not.toBe(created.data.colaborador.employee_id);
        expect(await count("customer")).toBe(1);
      });

      it("borrar un employee de otra company (company_id distinto) no borra nada", async () => {
        const created = await alta();

        await api.delete(
          `/admin/companies/comp_otra/employees/${created.data.colaborador.employee_id}`,
          adminHeaders
        );

        expect(await count("employee")).toBe(1);
        const conflicto = await errorOf(alta());
        expect(conflicto.status).toBe(409);
      });

      it.each([
        ["RUT con DV incorrecto", { rut: "12.345.678-9" }],
        ["correo inválido", { email: "juana.perez" }],
        ["nombre vacío", { first_name: "  " }],
      ])("400: %s; no crea nada", async (_caso, override) => {
        const res = await errorOf(alta({ ...BODY, ...override }));

        expect(res.status).toBe(400);
        expect(await count("customer")).toBe(0);
        expect(await count("provider_identity", { provider: "rut" })).toBe(0);
      });

      it("400: campos de más (p. ej. una clave) → rechazado por el validador", async () => {
        const res = await errorOf(alta({ ...BODY, password: "1234" }));
        expect(res.status).toBe(400);
        expect(await count("customer")).toBe(0);
      });

      it("400: correo ya usado por otro RUT; no deja identidad huérfana", async () => {
        await alta();
        const res = await errorOf(alta({ ...BODY, rut: "11.111.111-1" }));

        expect(res.status).toBe(400);
        expect(await count("customer")).toBe(1);

        const authModule = getContainer().resolve<IAuthModuleService>(Modules.AUTH);
        const huerfana = await authModule.listProviderIdentities({ provider: "rut", entity_id: "11111111-1" });
        expect(huerfana).toHaveLength(0);
      });

      it("401: sin sesión de admin", async () => {
        const res = await errorOf(api.post("/admin/colaboradores", BODY));
        expect(res.status).toBe(401);
      });
    });

    describe("Crear cliente del core: bloqueado", () => {
      it("POST /admin/customers → 403", async () => {
        const res = await errorOf(
          api.post("/admin/customers", { email: "x@sonriemarket.cl", first_name: "X", last_name: "Y" }, adminHeaders)
        );
        expect(res.status).toBe(403);
        expect(await count("customer")).toBe(0);
      });

      it("editar un cliente (POST /admin/customers/:id) sigue funcionando", async () => {
        const created = await alta();
        const id = created.data.colaborador.customer_id;

        const res = await api.post(`/admin/customers/${id}`, { first_name: "Juanita" }, adminHeaders);
        expect(res.status).toBe(200);
        expect(res.data.customer.first_name).toBe("Juanita");
      });
    });

    describe("util altaColaborador (lo usa el script)", () => {
      it("ya_existe la segunda vez; origen manual", async () => {
        const first = await altaColaborador(getContainer(), { ...BODY, origen: "manual" });
        const second = await altaColaborador(getContainer(), { ...BODY, origen: "manual" });

        expect(first.status).toBe("creado");
        expect(second.status).toBe("ya_existe");
      });

      it("invalido sin tocar la base", async () => {
        const r = await altaColaborador(getContainer(), { ...BODY, rut: "abc", origen: "manual" });
        expect(r.status).toBe("invalido");
        expect(await count("customer")).toBe(0);
      });
    });
  },
});
