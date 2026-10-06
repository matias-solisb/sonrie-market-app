import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { quotesEnabled } from "../../../src/api/middlewares/quotes-disabled";
import { adminHeaders, createAdminUser, createStoreUser } from "../../utils/admin";
import { generatePublishableKey, generateStoreHeaders } from "../../utils/store";

jest.setTimeout(60 * 1000);

/*

Las cotizaciones del B2B Starter están apagadas (src/api/middlewares/quotes-disabled.ts):
crean pedidos sin pasar por el checkout, así que se saltarían el cupo de
beneficio. Todas sus rutas deben responder 404, aun con sesión válida.

*/
const describeIfDisabled = quotesEnabled() ? describe.skip : describe;

medusaIntegrationTestRunner({
  inApp: true,
  env: { JWT_SECRET: "supersecret" },
  testSuite: ({ api, getContainer }) => {
    describeIfDisabled("cotizaciones desactivadas", () => {
      let storeHeaders: any;

      beforeEach(async () => {
        const container = getContainer();
        await createAdminUser(adminHeaders, container);
        const publishableKey = await generatePublishableKey(container);
        storeHeaders = generateStoreHeaders({ publishableKey });
        const user = await createStoreUser({ api, storeHeaders });
        storeHeaders.headers["Authorization"] = `Bearer ${user.token}`;
      });

      const status = (p: Promise<any>) =>
        p.then((r) => r.status).catch((e) => e.response.status);

      it("las rutas /store/quotes responden 404", async () => {
        expect(await status(api.get("/store/quotes", storeHeaders))).toBe(404);
        expect(await status(api.post("/store/quotes", { cart_id: "cart_x" }, storeHeaders))).toBe(404);
        expect(await status(api.get("/store/quotes/quo_x", storeHeaders))).toBe(404);
        expect(await status(api.get("/store/quotes/quo_x/preview", storeHeaders))).toBe(404);
        expect(await status(api.post("/store/quotes/quo_x/accept", {}, storeHeaders))).toBe(404);
        expect(await status(api.post("/store/quotes/quo_x/reject", {}, storeHeaders))).toBe(404);
        expect(await status(api.post("/store/quotes/quo_x/messages", { text: "hola" }, storeHeaders))).toBe(404);
      });

      it("las rutas /admin/quotes responden 404", async () => {
        expect(await status(api.get("/admin/quotes", adminHeaders))).toBe(404);
        expect(await status(api.get("/admin/quotes/quo_x", adminHeaders))).toBe(404);
        expect(await status(api.post("/admin/quotes/quo_x/send", {}, adminHeaders))).toBe(404);
        expect(await status(api.post("/admin/quotes/quo_x/reject", {}, adminHeaders))).toBe(404);
        expect(await status(api.post("/admin/quotes/quo_x/messages", { text: "hola" }, adminHeaders))).toBe(404);
      });

      it("el resto de la API sigue funcionando", async () => {
        expect(await status(api.get("/store/customers/me", storeHeaders))).toBe(200);
        expect(await status(api.get("/admin/benefit-budget/campaigns", adminHeaders))).toBe(200);
      });
    });
  },
});
