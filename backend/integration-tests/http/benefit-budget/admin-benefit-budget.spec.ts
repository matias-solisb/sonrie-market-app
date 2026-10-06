import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import {
  getPeriod,
  nextPeriod,
} from "../../../src/modules/benefit-budget/utils/period";
import benefitBudgetPeriodJob from "../../../src/jobs/benefit-budget-period";
import { adminHeaders } from "../../utils/admin";
import {
  complete,
  readyCart,
  setupShop,
  Shop,
  storeBalance,
  TOPE,
} from "../../utils/shop";

jest.setTimeout(120 * 1000);

/*

Administración del beneficio desde la Admin API
(npm run test:integration:http):

- Las rutas /admin/benefit-budget/* exigen usuario admin.
- Consulta del saldo y movimientos de un colaborador en un mes pasado.
- Edición de la campaña: validaciones y cambio de tope ("de ahora en
  adelante": el mes en curso conserva el tope con que se abrió).
- Job de apertura de periodo sin campaña activa.

*/

/** Una fecha a mediodía (Santiago) del periodo "YYYY-MM". */
const dateIn = (periodo: string) => new Date(`${periodo}-15T15:00:00Z`);

medusaIntegrationTestRunner({
  inApp: true,
  env: { JWT_SECRET: "supersecret" },
  testSuite: ({ api, getContainer }) => {
    let shop: Shop;

    beforeEach(async () => {
      shop = await setupShop({ api, getContainer });
    });

    const noAuth = (fn: () => Promise<any>) =>
      fn().catch((e: any) => e.response);

    describe("seguridad", () => {
      it("las rutas /admin/benefit-budget exigen sesión de admin", async () => {
        const store = shop.storeHeaders; // un colaborador NO es admin

        const calls = [
          () => api.get("/admin/benefit-budget/campaigns"),
          () => api.get("/admin/benefit-budget/campaigns", store),
          () =>
            api.post(`/admin/benefit-budget/campaigns/${shop.campaignId}`, {
              tope_por_colaborador: 1,
            }),
          () => api.get(`/admin/benefit-budget/customers/${shop.customerId}`),
          () =>
            api.post(
              `/admin/benefit-budget/customers/${shop.customerId}/override`,
              { tope_override: 999999 },
              store
            ),
        ];

        for (const call of calls) {
          const res = await noAuth(call);
          expect(res.status).toBe(401);
        }

        // Nada cambió
        const { campaigns } = (
          await api.get("/admin/benefit-budget/campaigns", adminHeaders)
        ).data;
        expect(campaigns[0].tope_por_colaborador).toBe(TOPE);
        expect((await storeBalance(api, store)).tope).toBe(TOPE);
      });
    });

    describe("saldo de un colaborador", () => {
      it("consulta un mes pasado con sus movimientos", async () => {
        // Consumo de agosto (sin pedido asociado) y una compra de este mes
        await shop.service.reserveConsumption({
          customer_id: shop.customerId,
          cart_id: "cart_historico",
          monto: 12345,
          fecha: dateIn("2026-08"),
        });
        const cart = await readyCart(api, shop, [
          { variant_id: shop.litro, quantity: 1 },
        ]);
        expect((await complete(api, cart.id, shop.storeHeaders)).status).toBe(200);

        const agosto = (
          await api.get(
            `/admin/benefit-budget/customers/${shop.customerId}?periodo=2026-08`,
            adminHeaders
          )
        ).data;

        expect(agosto.benefit_budget).toEqual(
          expect.objectContaining({
            periodo: "2026-08",
            tope: TOPE,
            consumido: 12345,
            disponible: TOPE - 12345,
            campaign_nombre: "Beneficio mensual",
          })
        );
        expect(agosto.movimientos).toEqual([
          expect.objectContaining({
            tipo: "consumo",
            monto: 12345,
            order_id: null,
            order_display_id: null,
          }),
        ]);

        // Sin periodo: el vigente, que no incluye agosto
        const actual = (
          await api.get(
            `/admin/benefit-budget/customers/${shop.customerId}`,
            adminHeaders
          )
        ).data;
        expect(actual.benefit_budget).toEqual(
          expect.objectContaining({ periodo: getPeriod(), consumido: 10000 })
        );
      });

      it("un mes sin compras muestra el tope completo y sin movimientos", async () => {
        const res = (
          await api.get(
            `/admin/benefit-budget/customers/${shop.customerId}?periodo=2026-01`,
            adminHeaders
          )
        ).data;

        expect(res.benefit_budget).toEqual(
          expect.objectContaining({
            budget_id: null,
            consumido: 0,
            disponible: TOPE,
          })
        );
        expect(res.movimientos).toEqual([]);
      });

      it("rechaza un periodo con formato inválido", async () => {
        for (const periodo of ["2026-13", "2026-1", "octubre"]) {
          const res = await noAuth(() =>
            api.get(
              `/admin/benefit-budget/customers/${shop.customerId}?periodo=${periodo}`,
              adminHeaders
            )
          );
          expect(res.status).toBe(400);
        }
      });
    });

    describe("edición de la campaña", () => {
      const updateCampaign = (body: Record<string, unknown>) =>
        noAuth(() =>
          api.post(
            `/admin/benefit-budget/campaigns/${shop.campaignId}`,
            body,
            adminHeaders
          )
        );

      it("valida el body", async () => {
        expect((await updateCampaign({ tope_por_colaborador: -1 })).status).toBe(400);
        expect((await updateCampaign({ tope_por_colaborador: 1000.5 })).status).toBe(400);
        expect((await updateCampaign({ tope_por_colaborador: "60000" })).status).toBe(400);
        expect((await updateCampaign({ estado: "pausada" })).status).toBe(400);
        expect((await updateCampaign({ nombre: "" })).status).toBe(400);
        expect((await updateCampaign({ periodo: "rango" })).status).toBe(400);
      });

      it("subir el tope a $60.000 rige desde el mes siguiente; el mes en curso conserva $50.000", async () => {
        // El job ya abrió el mes en curso (como en producción, el día 1)
        await benefitBudgetPeriodJob(getContainer());

        const res = await updateCampaign({ tope_por_colaborador: 60000 });
        expect(res.status).toBe(200);
        expect(res.data.campaign.tope_por_colaborador).toBe(60000);

        const actual = getPeriod();
        const siguiente = nextPeriod(actual);

        expect((await storeBalance(api, shop.storeHeaders)).tope).toBe(TOPE);

        const proximo = (
          await api.get(
            `/admin/benefit-budget/customers/${shop.customerId}?periodo=${siguiente}`,
            adminHeaders
          )
        ).data.benefit_budget;
        expect(proximo).toEqual(
          expect.objectContaining({ tope: 60000, disponible: 60000 })
        );

        // El checkout del mes en curso sigue validando contra $50.000
        const cart = await readyCart(api, shop, [
          { variant_id: shop.litro, quantity: 6 },
        ]);
        const fail = await complete(api, cart.id, shop.storeHeaders);
        expect(fail.status).toBe(400);
        expect(fail.data.message).toContain("Saldo de beneficio insuficiente");

        // Y el mes siguiente se abre con $60.000
        const r = await shop.service.reserveConsumption({
          customer_id: shop.customerId,
          cart_id: "cart_mes_siguiente",
          monto: 60000,
          fecha: dateIn(siguiente),
        });
        expect(r.periodo).toBe(siguiente);
      });
    });

    describe("auditoría de cambios de la campaña", () => {
      const cambios = async () =>
        (
          await api.get(
            `/admin/benefit-budget/campaigns/${shop.campaignId}/cambios`,
            adminHeaders
          )
        ).data.cambios;

      it("registra quién cambió el tope, el valor anterior y desde cuándo rige", async () => {
        const res = await api.post(
          `/admin/benefit-budget/campaigns/${shop.campaignId}`,
          { tope_por_colaborador: 60000 },
          adminHeaders
        );
        expect(res.data.rige_desde).toBe(nextPeriod(getPeriod()));

        const [cambio] = await cambios();
        expect(cambio).toEqual(
          expect.objectContaining({
            cambios: {
              tope_por_colaborador: { anterior: TOPE, nuevo: 60000 },
            },
            rige_desde: nextPeriod(getPeriod()),
            actor: expect.objectContaining({ email: "admin@medusa.js" }),
          })
        );
      });

      it("el historial va del más reciente al más antiguo y omite ediciones sin cambios", async () => {
        const post = (body: Record<string, unknown>) =>
          api.post(
            `/admin/benefit-budget/campaigns/${shop.campaignId}`,
            body,
            adminHeaders
          );

        await post({ tope_por_colaborador: 60000 });
        const igual = await post({ tope_por_colaborador: 60000 });
        expect(igual.data.rige_desde).toBeNull();
        await post({ nombre: "Beneficio Sonríe" });

        const lista = await cambios();
        expect(lista).toHaveLength(2);
        expect(lista[0].cambios).toEqual({
          nombre: { anterior: "Beneficio mensual", nuevo: "Beneficio Sonríe" },
        });
        expect(lista[0].rige_desde).toBeNull();
        expect(lista[1].cambios.tope_por_colaborador).toEqual({
          anterior: TOPE,
          nuevo: 60000,
        });
      });

      it("un cambio rechazado no deja registro", async () => {
        const otra = await shop.service.createBenefitCampaigns({
          nombre: "Otra",
          tope_por_colaborador: 1000,
          estado: "inactiva",
        });

        const res = await noAuth(() =>
          api.post(
            `/admin/benefit-budget/campaigns/${otra.id}`,
            { estado: "activa" },
            adminHeaders
          )
        );
        expect(res.status).toBe(400);
        expect(await shop.service.listBenefitCampaignChanges({})).toHaveLength(0);
      });

      it("el historial exige admin y responde 404 si la campaña no existe", async () => {
        const sinAdmin = await noAuth(() =>
          api.get(
            `/admin/benefit-budget/campaigns/${shop.campaignId}/cambios`,
            shop.storeHeaders
          )
        );
        expect(sinAdmin.status).toBe(401);

        const noExiste = await noAuth(() =>
          api.get("/admin/benefit-budget/campaigns/bcamp_no_existe/cambios", adminHeaders)
        );
        expect(noExiste.status).toBe(404);
      });

      it("GET campaigns informa el periodo actual y el siguiente", async () => {
        const { data } = await api.get(
          "/admin/benefit-budget/campaigns",
          adminHeaders
        );
        expect(data.periodo_actual).toBe(getPeriod());
        expect(data.periodo_siguiente).toBe(nextPeriod(getPeriod()));
      });
    });

    describe("job de apertura de periodo", () => {
      it("sin campaña activa no crea saldos", async () => {
        await shop.service.updateBenefitCampaigns({
          id: shop.campaignId,
          estado: "inactiva",
        });

        await benefitBudgetPeriodJob(getContainer());

        expect(await shop.service.listEmployeeBudgets({})).toHaveLength(0);
      });
    });
  },
});
