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

Reemplaza los tests originales del B2B Starter, que creaban, editaban y
borraban companies desde la tienda con cualquier customer logueado. En
Sonríe Market hay una sola company (src/utils/sonrie-company.ts) y un
colaborador común (employee con is_admin: false) solo puede leerla:

- GET  /store/companies/:id                 → 200
- POST /store/companies                     → 403 (nadie crea companies)
- POST /store/companies/:id                 → 403 (solo company_admin)
- DELETE /store/companies/:id               → 403 (nadie borra companies)
- POST /store/companies/:id/employees       → 403 (solo company_admin)
- POST /store/companies/:id/employees/:id   → 403 (no puede hacerse admin)

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

    it("GET /store/companies/:id devuelve la company", async () => {
      const res = await api.get(`/store/companies/${company.id}`, storeHeaders);

      expect(res.status).toBe(200);
      expect(res.data.company.id).toBe(company.id);
    });

    it("GET de una company inexistente responde not_found", async () => {
      const { response } = await api
        .get(`/store/companies/does-not-exist`, storeHeaders)
        .catch((e) => e);

      expect(response.data).toMatchObject({ type: "not_found" });
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
