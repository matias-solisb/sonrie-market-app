import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { adminHeaders, createAdminUser, createStoreUser } from "../../utils/admin";
import {
  generatePublishableKey,
  generateStoreHeaders,
} from "../../utils/store";

jest.setTimeout(120 * 1000);

/*

Barra de anuncios (npm run test:integration:http):
- CRUD en /admin/announcements y validaciones (link, rango de vigencia);
- /admin/announcements/settings crea la fila global con defaults;
- /store/announcements devuelve solo activos y vigentes, y nada a
  visitantes sin sesión salvo que el lugar "login" esté habilitado.

*/
medusaIntegrationTestRunner({
  inApp: true,
  env: { JWT_SECRET: "supersecret" },
  testSuite: ({ api, getContainer }) => {
    let anonHeaders: any;
    let customerHeaders: any;

    const hoursFromNow = (hours: number) =>
      new Date(Date.now() + hours * 3600 * 1000).toISOString();

    const createAnnouncement = async (body: Record<string, unknown>) =>
      (
        await api.post(
          "/admin/announcements",
          { nombre: "Aviso", texto: "Texto del aviso", ...body },
          adminHeaders
        )
      ).data.announcement;

    beforeEach(async () => {
      const container = getContainer();
      await createAdminUser(adminHeaders, container);
      const publishableKey = await generatePublishableKey(container);
      anonHeaders = generateStoreHeaders({ publishableKey });

      const { token } = await createStoreUser({ api, container });
      customerHeaders = {
        headers: { ...anonHeaders.headers, Authorization: `Bearer ${token}` },
      };
    });

    describe("Admin", () => {
      it("crea, lista, edita y elimina un anuncio", async () => {
        const created = await createAnnouncement({
          nombre: "Periodo cerrado",
          link: "/products",
          icono: "camion",
          posicion_icono: "derecha",
        });

        expect(created).toEqual(
          expect.objectContaining({
            nombre: "Periodo cerrado",
            link: "/products",
            icono: "camion",
            posicion_icono: "derecha",
            activo: true,
            fecha_inicio: null,
            fecha_fin: null,
          })
        );

        const list = await api.get(
          "/admin/announcements?q=cerrado",
          adminHeaders
        );
        expect(list.data.count).toBe(1);

        const updated = await api.post(
          `/admin/announcements/${created.id}`,
          { activo: false, link: "" },
          adminHeaders
        );
        expect(updated.data.announcement).toEqual(
          expect.objectContaining({ activo: false, link: null })
        );

        const inactivos = await api.get(
          "/admin/announcements?activo=false",
          adminHeaders
        );
        expect(inactivos.data.announcements.map((a) => a.id)).toEqual([
          created.id,
        ]);

        await api.delete(`/admin/announcements/${created.id}`, adminHeaders);
        const after = await api.get("/admin/announcements", adminHeaders);
        expect(after.data.count).toBe(0);
      });

      it("rechaza links peligrosos o protocol-relative", async () => {
        for (const link of ["javascript:alert(1)", "//evil.com", "ftp://x"]) {
          const error = await api
            .post(
              "/admin/announcements",
              { nombre: "x", texto: "x", link },
              adminHeaders
            )
            .catch((e) => e);
          expect(error.response.status).toBe(400);
        }
      });

      it("rechaza un fin anterior al inicio, también en update parcial", async () => {
        const error = await api
          .post(
            "/admin/announcements",
            {
              nombre: "x",
              texto: "x",
              fecha_inicio: hoursFromNow(2),
              fecha_fin: hoursFromNow(1),
            },
            adminHeaders
          )
          .catch((e) => e);
        expect(error.response.status).toBe(400);

        const created = await createAnnouncement({
          fecha_inicio: hoursFromNow(2),
        });
        const updateError = await api
          .post(
            `/admin/announcements/${created.id}`,
            { fecha_fin: hoursFromNow(1) },
            adminHeaders
          )
          .catch((e) => e);
        expect(updateError.response.status).toBe(400);
      });

      it("la configuración general se crea con defaults y se edita", async () => {
        const { data } = await api.get(
          "/admin/announcements/settings",
          adminHeaders
        );
        expect(data.settings).toEqual(
          expect.objectContaining({
            intervalo_segundos: 5,
            color_fondo: "#E01441",
            color_texto: "#FFFFFF",
            color_borde: null,
          })
        );
        expect(data.settings.lugares).not.toContain("login");

        const updated = await api.post(
          "/admin/announcements/settings",
          {
            intervalo_segundos: 8,
            lugares: ["home", "login"],
            color_borde: "#000000",
          },
          adminHeaders
        );
        expect(updated.data.settings).toEqual(
          expect.objectContaining({
            id: data.settings.id,
            intervalo_segundos: 8,
            lugares: ["home", "login"],
            color_borde: "#000000",
          })
        );

        const invalid = await api
          .post(
            "/admin/announcements/settings",
            { color_fondo: "red", intervalo_segundos: 1 },
            adminHeaders
          )
          .catch((e) => e);
        expect(invalid.response.status).toBe(400);
      });
    });

    describe("Store", () => {
      it("devuelve solo anuncios activos y vigentes, en orden de creación", async () => {
        const primero = await createAnnouncement({ texto: "primero" });
        await createAnnouncement({ texto: "inactivo", activo: false });
        await createAnnouncement({
          texto: "futuro",
          fecha_inicio: hoursFromNow(1),
        });
        await createAnnouncement({
          texto: "expirado",
          fecha_inicio: hoursFromNow(-2),
          fecha_fin: hoursFromNow(-1),
        });
        const segundo = await createAnnouncement({
          texto: "segundo",
          fecha_fin: hoursFromNow(1),
        });

        const { data } = await api.get("/store/announcements", customerHeaders);

        expect(data.announcements.map((a) => a.id)).toEqual([
          primero.id,
          segundo.id,
        ]);
        expect(data.announcements[0]).not.toHaveProperty("nombre");
        expect(data.settings).toEqual(
          expect.objectContaining({ intervalo_segundos: 5 })
        );
        expect(data.settings).not.toHaveProperty("id");
      });

      it("sin sesión no expone anuncios salvo que 'login' esté habilitado", async () => {
        await createAnnouncement({ texto: "aviso interno" });

        const anon = await api.get("/store/announcements", anonHeaders);
        expect(anon.data.announcements).toEqual([]);

        await api.post(
          "/admin/announcements/settings",
          { lugares: ["home", "login"] },
          adminHeaders
        );

        const anonLogin = await api.get("/store/announcements", anonHeaders);
        expect(anonLogin.data.announcements).toHaveLength(1);
      });
    });
  },
});
