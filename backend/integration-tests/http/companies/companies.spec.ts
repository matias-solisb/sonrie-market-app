import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import {
  adminHeaders,
  createAdminUser,
  createColaboradorSession,
} from "../../utils/admin";
import { generatePublishableKey, generateStoreHeaders } from "../../utils/store";

jest.setTimeout(60 * 1000);

/*

La company desde la Store API (npm run test:integration:http).

Vulnerabilidad #1 (docs/vulnerabilidades.md): las rutas /store/companies*
exponían a cualquier colaborador los datos de todos los demás (nombre,
correo, teléfono, cupo). En Sonríe Market la company se gestiona solo desde
el Admin, así que toda la Store API de companies responde 403:

- GET  /store/companies/:id                          → 403 (con o sin fields)
- GET  /store/companies/:id/employees                → 403
- GET  /store/companies/:id/employees/:id            → 403
- POST /store/companies                              → 403
- POST /store/companies/:id                          → 403
- DELETE /store/companies/:id                        → 403
- POST /store/companies/:id/employees                → 403
- POST /store/companies/:id/employees/:id            → 403
- POST /store/companies/:id/approval-settings        → 403

*/

const status = (p: Promise<any>) =>
  p.then((r) => r.status).catch((e) => e.response?.status);

medusaIntegrationTestRunner({
  inApp: true,
  env: { JWT_SECRET: "supersecret" },
  testSuite: ({ api, getContainer }) => {
    let storeHeaders: any;
    let company: { id: string; name: string };
    let employeeId: string;

    const companyInDb = async (container: MedusaContainer) => {
      const query = container.resolve(ContainerRegistrationKeys.QUERY);
      const { data } = await query.graph({
        entity: "company",
        fields: ["id", "name", "email"],
      });
      return data;
    };

    beforeEach(async () => {
      const container = getContainer();
      await createAdminUser(adminHeaders, container);
      const publishableKey = await generatePublishableKey(container);
      storeHeaders = generateStoreHeaders({ publishableKey });

      const session = await createColaboradorSession({
        api,
        container,
        email: "juana.perez@sonriemarket.cl",
      });
      storeHeaders.headers["Authorization"] = `Bearer ${session.token}`;
      company = session.employee.company;
      employeeId = session.employee.id;
    });

    it.each([
      ["la company", () => `/store/companies/${company.id}`],
      [
        "la company con *employees.customer",
        () => `/store/companies/${company.id}?fields=*employees.customer`,
      ],
      ["los employees", () => `/store/companies/${company.id}/employees`],
      [
        "un employee",
        () => `/store/companies/${company.id}/employees/${employeeId}`,
      ],
      ["una company inexistente", () => `/store/companies/does-not-exist`],
    ])("GET de %s responde 403", async (_label, url) => {
      const res = await api.get(url(), storeHeaders).catch((e) => e.response);

      expect(res.status).toBe(403);
      expect(JSON.stringify(res.data)).not.toContain("juana.perez");
    });

    it("sin sesión también responde 403", async () => {
      const { Authorization, ...headers } = storeHeaders.headers;
      const code = await status(
        api.get(`/store/companies/${company.id}/employees`, { headers })
      );

      expect(code).toBe(403);
    });

    it("POST approval-settings: un colaborador no puede cambiarlas", async () => {
      const code = await status(
        api.post(
          `/store/companies/${company.id}/approval-settings`,
          { requires_admin_approval: true },
          storeHeaders
        )
      );

      expect(code).toBe(403);
    });

    it("POST /store/companies: un colaborador no puede crear companies", async () => {
      const code = await status(
        api.post(
          "/store/companies",
          {
            name: "Mi Empresa",
            email: "yo@empresa.cl",
            currency_code: "clp",
            spending_limit_reset_frequency: "monthly",
          },
          storeHeaders
        )
      );

      expect(code).toBe(403);
      expect(await companyInDb(getContainer())).toHaveLength(1);
    });

    it("POST /store/companies/:id: un colaborador no puede editar la company", async () => {
      const code = await status(
        api.post(
          `/store/companies/${company.id}`,
          { name: "Hackeada" },
          storeHeaders
        )
      );

      expect(code).toBe(403);
      expect((await companyInDb(getContainer()))[0].name).toBe(company.name);
    });

    it("DELETE /store/companies/:id: un colaborador no puede borrar la company", async () => {
      const code = await status(
        api.delete(`/store/companies/${company.id}`, storeHeaders)
      );

      expect(code).toBe(403);
      expect(await companyInDb(getContainer())).toHaveLength(1);
    });

    it("un colaborador no puede agregar employees a la company", async () => {
      const code = await status(
        api.post(
          `/store/companies/${company.id}/employees`,
          { spending_limit: 0, is_admin: true },
          storeHeaders
        )
      );

      expect(code).toBe(403);
    });

    it("un colaborador no puede hacerse company_admin", async () => {
      const code = await status(
        api.post(
          `/store/companies/${company.id}/employees/${employeeId}`,
          { is_admin: true },
          storeHeaders
        )
      );

      expect(code).toBe(403);

      const query = getContainer().resolve(ContainerRegistrationKeys.QUERY);
      const { data } = await query.graph({
        entity: "employee",
        fields: ["is_admin"],
        filters: { id: employeeId },
      });
      expect(data[0].is_admin).toBe(false);
    });
  },
});
