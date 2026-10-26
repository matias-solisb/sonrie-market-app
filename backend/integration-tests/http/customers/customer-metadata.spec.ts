import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { adminHeaders, createAdminUser, createStoreUser } from "../../utils/admin";
import { generatePublishableKey, generateStoreHeaders } from "../../utils/store";

jest.setTimeout(60 * 1000);

/*

Vulnerabilidad #6: el colaborador no puede escribir la `metadata` de su
customer (src/api/middlewares/customer-metadata-locked.ts). El resto del
perfil (nombre, apellido, teléfono) se sigue editando; el Admin sí puede
editar la metadata.

*/
medusaIntegrationTestRunner({
  inApp: true,
  env: { JWT_SECRET: "supersecret" },
  testSuite: ({ api, getContainer }) => {
    describe("POST /store/customers/me y metadata", () => {
      let storeHeaders: any;
      let customerId: string;

      beforeEach(async () => {
        const container = getContainer();
        await createAdminUser(adminHeaders, container);
        const publishableKey = await generatePublishableKey(container);
        storeHeaders = generateStoreHeaders({ publishableKey });
        const user = await createStoreUser({ api, storeHeaders, container });
        storeHeaders.headers["Authorization"] = `Bearer ${user.token}`;
        customerId = user.customer.id;
      });

      const me = async () =>
        (await api.get("/store/customers/me?fields=+metadata", storeHeaders)).data
          .customer;

      it("rechaza metadata con 400 y no cambia nada", async () => {
        for (const body of [
          { metadata: { rut: "12.345.678-5" } },
          { first_name: "Otro", metadata: { rut: "12.345.678-5" } },
          { metadata: null },
          { metadata: {} },
        ]) {
          const res = await api
            .post("/store/customers/me", body, storeHeaders)
            .catch((e: any) => e.response);
          expect({ body, status: res.status }).toEqual({ body, status: 400 });
        }

        const admin = (
          await api.get(`/admin/customers/${customerId}?fields=+metadata`, adminHeaders)
        ).data.customer;
        expect(admin.metadata?.rut).toBeUndefined();
        expect(admin.first_name).not.toBe("Otro");
      });

      it("sin metadata, el perfil se edita igual que antes", async () => {
        const res = await api.post(
          "/store/customers/me",
          { first_name: "Ana", last_name: "Pérez", phone: "+56912345678" },
          storeHeaders
        );
        expect(res.status).toBe(200);
        expect(await me()).toMatchObject({
          first_name: "Ana",
          last_name: "Pérez",
          phone: "+56912345678",
        });
      });

      it("el Admin sí puede editar la metadata", async () => {
        const res = await api.post(
          `/admin/customers/${customerId}`,
          { metadata: { nota: "x" } },
          adminHeaders
        );
        expect(res.status).toBe(200);
        expect(res.data.customer.metadata).toMatchObject({ nota: "x" });
      });
    });
  },
});
