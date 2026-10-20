import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { CLAVE_COLABORADOR, createColaboradorSession } from "../../utils/admin";
import { generatePublishableKey, generateStoreHeaders } from "../../utils/store";

jest.setTimeout(60 * 1000);

/*

Cambio de clave (rut-auth, paso 6) — npm run test:integration:http.

Cambio obligatorio (colaborador recién creado, clave inicial)
- GET /store/customers/me/password → must_change_password: true.
- Mientras esté pendiente: /store/customers/me responde; el resto de la
  Store API → 403 password_change_required. Sin sesión, la Store API
  pública no se bloquea.
- Errores: sin clave actual, clave actual incorrecta, clave derivada del RUT
  → 400 y el cambio sigue pendiente.
- Cambio correcto → 200, se levanta el bloqueo con el MISMO token, la clave
  inicial deja de servir y la nueva sí.
- El RUT sale de la sesión: un `rut` en el body no cambia otra cuenta.

Cambio desde el perfil (colaborador que ya cambió la clave)
- Funciona con la clave actual; la misma clave → 400.
- Sin sesión → 401.

*/

const status = (p: Promise<any>) =>
  p.then((r) => r.status).catch((e) => e.response?.status);

const errorOf = (p: Promise<any>) =>
  p.then(
    () => null,
    (e) => e.response
  );

const NUEVA = "OtraClaveSegura";

medusaIntegrationTestRunner({
  inApp: true,
  env: { JWT_SECRET: "supersecret" },
  testSuite: ({ api, getContainer }) => {
    let pk: Record<string, string>;

    beforeEach(async () => {
      pk = generateStoreHeaders({
        publishableKey: await generatePublishableKey(getContainer()),
      }).headers;
    });

    const conToken = (token: string) => ({
      headers: { ...pk, Authorization: `Bearer ${token}` },
    });

    const recienCreado = () =>
      createColaboradorSession({
        api,
        container: getContainer(),
        email: "juana.perez@sonriemarket.cl",
        cambiarClave: false,
      });

    const login = (rut: string, password: string) =>
      status(api.post("/auth/customer/rut", { rut, password }));

    describe("cambio obligatorio pendiente", () => {
      it("el estado dice que hay que cambiar la clave", async () => {
        const { token } = await recienCreado();

        const res = await api.get("/store/customers/me/password", conToken(token));

        expect(res.status).toBe(200);
        expect(res.data).toEqual({ must_change_password: true });
      });

      it("/store/customers/me sigue respondiendo", async () => {
        const { token, customer } = await recienCreado();

        const res = await api.get("/store/customers/me", conToken(token));

        expect(res.data.customer.id).toBe(customer.id);
      });

      it.each([
        ["GET", "/store/benefit-budget"],
        ["GET", "/store/products"],
        ["GET", "/store/customers/me/addresses"],
        ["POST", "/store/carts"],
      ])("%s %s → 403 password_change_required", async (method, path) => {
        const { token } = await recienCreado();

        const res = await errorOf(
          method === "GET"
            ? api.get(path, conToken(token))
            : api.post(path, {}, conToken(token))
        );

        expect(res.status).toBe(403);
        expect(res.data.code).toBe("password_change_required");
      });

      it("sin sesión la Store API pública no se bloquea", async () => {
        await recienCreado();

        expect(await status(api.get("/store/regions", { headers: pk }))).toBe(200);
      });
    });

    describe("errores al cambiar la clave", () => {
      it.each([
        ["sin clave actual", { password: NUEVA }, "current_password_required"],
        ["clave actual incorrecta", { current_password: "0000", password: NUEVA }, "invalid_current_password"],
        ["sin clave nueva", { current_password: "PENDIENTE" }, "password_required"],
        ["clave nueva corta", { current_password: "PENDIENTE", password: "corta" }, "password_policy"],
        ["clave nueva derivada del RUT", { current_password: "PENDIENTE", password: "PENDIENTE-Soprole" }, "password_policy"],
      ])("%s → 400 y sigue pendiente", async (_caso, body, code) => {
        const { token, password: inicial } = await recienCreado();
        const payload = JSON.parse(JSON.stringify(body).replace(/PENDIENTE/g, inicial));

        const res = await errorOf(
          api.post("/store/customers/me/password", payload, conToken(token))
        );

        expect(res.status).toBe(400);
        expect(res.data.code).toBe(code);

        const estado = await api.get("/store/customers/me/password", conToken(token));
        expect(estado.data.must_change_password).toBe(true);
      });
    });

    describe("cambio correcto", () => {
      it("levanta el bloqueo con el mismo token y cambia la clave", async () => {
        const { token, rut, password: inicial } = await recienCreado();

        const res = await api.post(
          "/store/customers/me/password",
          { current_password: inicial, password: NUEVA },
          conToken(token)
        );
        expect(res.status).toBe(200);

        const estado = await api.get("/store/customers/me/password", conToken(token));
        expect(estado.data.must_change_password).toBe(false);

        expect(
          await status(api.get("/store/customers/me/addresses", conToken(token)))
        ).toBe(200);

        expect(await login(rut, inicial)).toBe(401);
        expect(await login(rut, NUEVA)).toBe(200);
      });

      it("un rut en el body no cambia la clave de otra cuenta", async () => {
        const otra = await createColaboradorSession({
          api,
          container: getContainer(),
          email: "pedro@sonriemarket.cl",
        });
        const { token, password: inicial } = await recienCreado();

        await api.post(
          "/store/customers/me/password",
          { current_password: inicial, password: NUEVA, rut: otra.rut },
          conToken(token)
        );

        expect(await login(otra.rut, CLAVE_COLABORADOR)).toBe(200);
        expect(await login(otra.rut, NUEVA)).toBe(401);
      });
    });

    describe("cambio desde el perfil", () => {
      it("un colaborador que ya cambió la clave puede cambiarla de nuevo", async () => {
        const { token, rut } = await createColaboradorSession({
          api,
          container: getContainer(),
          email: "juana.perez@sonriemarket.cl",
        });

        const res = await api.post(
          "/store/customers/me/password",
          { current_password: CLAVE_COLABORADOR, password: NUEVA },
          conToken(token)
        );

        expect(res.status).toBe(200);
        expect(await login(rut, NUEVA)).toBe(200);
      });

      it("la misma clave → 400 same_password", async () => {
        const { token } = await createColaboradorSession({
          api,
          container: getContainer(),
          email: "juana.perez@sonriemarket.cl",
        });

        const res = await errorOf(
          api.post(
            "/store/customers/me/password",
            { current_password: CLAVE_COLABORADOR, password: CLAVE_COLABORADOR },
            conToken(token)
          )
        );

        expect(res.status).toBe(400);
        expect(res.data.code).toBe("same_password");
      });

      it("sin sesión → 401", async () => {
        expect(
          await status(
            api.post(
              "/store/customers/me/password",
              { current_password: "x", password: NUEVA },
              { headers: pk }
            )
          )
        ).toBe(401);
      });
    });
  },
});
