import { moduleIntegrationTestRunner } from "@medusajs/test-utils";
import { BENEFIT_BUDGET_MODULE } from "..";
import BenefitBudgetModuleService from "../service";
import { BenefitCampaign, BenefitMovement, EmployeeBudget } from "../models";

jest.setTimeout(60 * 1000);

/*

Pruebas del servicio contra una BD real (npm run test:integration:modules).
Cubren lo que el hook del checkout necesita: tope acumulado del mes,
idempotencia por carrito, compensación, concurrencia y corte de mes en hora
de Santiago.

*/

const CUSTOMER = "cus_test_01";
const OCT = new Date("2026-10-15T15:00:00Z");
const NOV = new Date("2026-11-01T03:00:00Z"); // 1-nov 00:00 Santiago

moduleIntegrationTestRunner<BenefitBudgetModuleService>({
  moduleName: BENEFIT_BUDGET_MODULE,
  moduleModels: [BenefitCampaign, EmployeeBudget, BenefitMovement],
  resolve: "./src/modules/benefit-budget",
  testSuite: ({ service }) => {
    describe("sin campaña activa", () => {
      it("bloquea el consumo", async () => {
        await expect(
          service.reserveConsumption({
            customer_id: CUSTOMER,
            cart_id: "cart_x",
            monto: 1000,
          })
        ).rejects.toThrow("No hay una campaña de beneficio activa");
      });
    });

    describe("con campaña mensual de $50.000", () => {
      beforeEach(async () => {
        await service.createBenefitCampaigns({
          nombre: "Beneficio mensual",
          tope_por_colaborador: 50000,
        });
      });

      it("registra el consumo y descuenta del saldo", async () => {
        const r = await service.reserveConsumption({
          customer_id: CUSTOMER,
          cart_id: "cart_1",
          monto: 30000,
          fecha: OCT,
        });

        expect(r).toEqual(
          expect.objectContaining({ created: true, periodo: "2026-10" })
        );

        const balance = await service.getBalance(CUSTOMER, OCT);
        expect(balance).toEqual(
          expect.objectContaining({ tope: 50000, consumido: 30000, disponible: 20000 })
        );
      });

      it("suma los pedidos del mes y bloquea el que excede", async () => {
        await service.reserveConsumption({
          customer_id: CUSTOMER, cart_id: "cart_1", monto: 40000, fecha: OCT,
        });

        await expect(
          service.reserveConsumption({
            customer_id: CUSTOMER, cart_id: "cart_2", monto: 40000, fecha: OCT,
          })
        ).rejects.toThrow("Saldo de beneficio insuficiente");

        const balance = await service.getBalance(CUSTOMER, OCT);
        expect(balance.consumido).toBe(40000);
        const movements = await service.listBenefitMovements({});
        expect(movements).toHaveLength(1);
      });

      it("permite justo el tope", async () => {
        await service.reserveConsumption({
          customer_id: CUSTOMER, cart_id: "cart_1", monto: 50000, fecha: OCT,
        });
        expect((await service.getBalance(CUSTOMER, OCT)).disponible).toBe(0);
      });

      it("es idempotente por carrito (reintento de completeCart)", async () => {
        const first = await service.reserveConsumption({
          customer_id: CUSTOMER, cart_id: "cart_1", monto: 30000, fecha: OCT,
        });
        const second = await service.reserveConsumption({
          customer_id: CUSTOMER, cart_id: "cart_1", monto: 30000, fecha: OCT,
        });

        expect(second.created).toBe(false);
        expect(second.movement_id).toBe(first.movement_id);
        expect((await service.getBalance(CUSTOMER, OCT)).consumido).toBe(30000);
      });

      it("la compensación devuelve el saldo y libera el carrito", async () => {
        const r = await service.reserveConsumption({
          customer_id: CUSTOMER, cart_id: "cart_1", monto: 30000, fecha: OCT,
        });

        await service.revertConsumption(r.movement_id);
        expect((await service.getBalance(CUSTOMER, OCT)).consumido).toBe(0);

        // el mismo carrito puede volver a intentarse
        const retry = await service.reserveConsumption({
          customer_id: CUSTOMER, cart_id: "cart_1", monto: 30000, fecha: OCT,
        });
        expect(retry.created).toBe(true);
        expect((await service.getBalance(CUSTOMER, OCT)).consumido).toBe(30000);

        // revertir dos veces no resta dos veces
        await service.revertConsumption(retry.movement_id);
        await service.revertConsumption(retry.movement_id);
        expect((await service.getBalance(CUSTOMER, OCT)).consumido).toBe(0);
      });

      it("no se pasa del tope con checkouts simultáneos", async () => {
        const results = await Promise.allSettled(
          [1, 2, 3, 4].map((i) =>
            service.reserveConsumption({
              customer_id: CUSTOMER, cart_id: `cart_${i}`, monto: 20000, fecha: OCT,
            })
          )
        );

        const ok = results.filter((r) => r.status === "fulfilled");
        expect(ok).toHaveLength(2);
        expect((await service.getBalance(CUSTOMER, OCT)).consumido).toBe(40000);

        const budgets = await service.listEmployeeBudgets({ customer_id: CUSTOMER });
        expect(budgets).toHaveLength(1);
      });

      it("el mes nuevo (hora de Santiago) parte con el cupo completo", async () => {
        await service.reserveConsumption({
          customer_id: CUSTOMER, cart_id: "cart_1", monto: 50000, fecha: OCT,
        });
        const nov = await service.reserveConsumption({
          customer_id: CUSTOMER, cart_id: "cart_2", monto: 50000, fecha: NOV,
        });

        expect(nov.periodo).toBe("2026-11");
        expect((await service.getBalance(CUSTOMER, NOV)).disponible).toBe(0);
        expect((await service.getBalance(CUSTOMER, OCT)).consumido).toBe(50000);
      });

      it("respeta el tope_override del colaborador", async () => {
        const r = await service.reserveConsumption({
          customer_id: CUSTOMER, cart_id: "cart_1", monto: 50000, fecha: OCT,
        });
        await service.updateEmployeeBudgets({ id: r.budget_id, tope_override: 70000 });

        await service.reserveConsumption({
          customer_id: CUSTOMER, cart_id: "cart_2", monto: 20000, fecha: OCT,
        });
        expect(await service.getBalance(CUSTOMER, OCT)).toEqual(
          expect.objectContaining({ tope: 70000, consumido: 70000, disponible: 0 })
        );
      });

      it("rechaza montos no enteros o negativos", async () => {
        await expect(
          service.reserveConsumption({ customer_id: CUSTOMER, cart_id: "c", monto: 10.5 })
        ).rejects.toThrow("Monto de beneficio inválido");
        await expect(
          service.reserveConsumption({ customer_id: CUSTOMER, cart_id: "c", monto: -1 })
        ).rejects.toThrow("Monto de beneficio inválido");
      });
    });
  },
});
