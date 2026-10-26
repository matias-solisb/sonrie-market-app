import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { MedusaContainer } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils";
import { COMPANY_MODULE } from "../../../src/modules/company";
import { ApprovalStatusType } from "../../../src/types/approval";
import {
  createApprovalsWorkflow,
  updateApprovalSettingsWorkflow,
} from "../../../src/workflows/approval/workflows";
import {
  adminHeaders,
  createAdminUser,
  createColaboradorSession,
} from "../../utils/admin";
import { generatePublishableKey, generateStoreHeaders } from "../../utils/store";

jest.setTimeout(60 * 1000);

/*

Aprobaciones desde la Store API (npm run test:integration:http).

El flujo de aprobación está apagado (APPROVALS_ENABLED, fuera del MVP); acá
las aprobaciones se crean directo con el workflow para probar el GET.

Vulnerabilidad #1 (docs/vulnerabilidades.md): GET /store/approvals devolvía
los carritos en aprobación de toda la company (vista de company_admin). Ahora:

- GET  /store/approvals       → 200 para cualquier colaborador, solo con SUS
                                carritos (panel "Pending Approvals" de
                                /account/orders).
- POST /store/approvals/:id   → 403: aprobar/rechazar es solo del Admin.

*/

const status = (p: Promise<any>) =>
  p.then((r) => r.status).catch((e) => e.response?.status);

medusaIntegrationTestRunner({
  inApp: true,
  env: { JWT_SECRET: "supersecret" },
  testSuite: ({ api, getContainer }) => {
    let publishableKey: any;
    let a: { headers: any; cartId: string; approvalId: string };
    let b: { headers: any; cartId: string; approvalId: string };
    let companyId: string;

    const carritoEnAprobacion = async (
      container: MedusaContainer,
      companyId: string,
      customerId: string,
      email: string
    ) => {
      const cartModule = container.resolve(Modules.CART);
      const cart = await cartModule.createCarts({
        currency_code: "clp",
        customer_id: customerId,
        email,
      });

      await container.resolve(ContainerRegistrationKeys.LINK).create({
        [COMPANY_MODULE]: { company_id: companyId },
        [Modules.CART]: { cart_id: cart.id },
      });

      const { result } = await createApprovalsWorkflow(container).run({
        // Igual que POST /store/carts/:id/approvals (status: PENDING).
        input: {
          cart_id: cart.id,
          created_by: customerId,
          status: ApprovalStatusType.PENDING,
        } as any,
      });
      const approvals = Array.isArray(result) ? result : [result];

      return { cartId: cart.id, approvalId: approvals[0].id };
    };

    const colaborador = async (container: MedusaContainer, email: string) => {
      const session = await createColaboradorSession({ api, container, email });
      const headers = generateStoreHeaders({ publishableKey });
      headers.headers["Authorization"] = `Bearer ${session.token}`;
      return { session, headers };
    };

    beforeEach(async () => {
      const container = getContainer();
      await createAdminUser(adminHeaders, container);
      publishableKey = await generatePublishableKey(container);

      const juana = await colaborador(container, "juana.perez@sonriemarket.cl");
      const pedro = await colaborador(container, "pedro.soto@sonriemarket.cl");
      companyId = juana.session.employee.company.id;

      // La company exige aprobación del admin para que se creen approvals.
      const query = container.resolve(ContainerRegistrationKeys.QUERY);
      const {
        data: [company],
      } = await query.graph({
        entity: "company",
        fields: ["approval_settings.id"],
        filters: { id: companyId },
      });
      await updateApprovalSettingsWorkflow(container).run({
        input: {
          id: company.approval_settings.id,
          requires_admin_approval: true,
        },
      });

      a = {
        headers: juana.headers,
        ...(await carritoEnAprobacion(
          container,
          companyId,
          juana.session.customer.id,
          "juana.perez@sonriemarket.cl"
        )),
      };
      b = {
        headers: pedro.headers,
        ...(await carritoEnAprobacion(
          container,
          companyId,
          pedro.session.customer.id,
          "pedro.soto@sonriemarket.cl"
        )),
      };
    });

    it("GET /store/approvals: cada colaborador ve solo sus carritos", async () => {
      const resA = await api.get("/store/approvals?status=pending", a.headers);
      const resB = await api.get("/store/approvals?status=pending", b.headers);

      expect(resA.status).toBe(200);
      expect(resA.data.carts_with_approvals.map((c) => c.id)).toEqual([
        a.cartId,
      ]);
      expect(resB.data.carts_with_approvals.map((c) => c.id)).toEqual([
        b.cartId,
      ]);
    });

    it("POST /store/approvals/:id: un colaborador no puede aprobar", async () => {
      const code = await status(
        api.post(
          `/store/approvals/${b.approvalId}`,
          { status: "approved", handled_by: "x" },
          a.headers
        )
      );

      expect(code).toBe(403);

      const query = getContainer().resolve(ContainerRegistrationKeys.QUERY);
      const { data } = await query.graph({
        entity: "approval",
        fields: ["status"],
        filters: { id: b.approvalId },
      });
      expect(data[0].status).toBe("pending");
    });

    describe("flujo de aprobación apagado (fuera del MVP, approvals-disabled.ts)", () => {
      it("POST /store/carts/:id/approvals: un colaborador no puede pedir aprobación", async () => {
        const code = await status(
          api.post(`/store/carts/${b.cartId}/approvals`, {}, a.headers)
        );

        expect(code).toBe(404);
      });

      it("GET /admin/approvals responde 404", async () => {
        const code = await status(api.get("/admin/approvals", adminHeaders));

        expect(code).toBe(404);
      });

      it("POST /admin/companies/:id/approval-settings responde 404", async () => {
        const code = await status(
          api.post(
            `/admin/companies/${companyId}/approval-settings`,
            { requires_admin_approval: true },
            adminHeaders
          )
        );

        expect(code).toBe(404);
      });
    });

    it("sin sesión responde 401", async () => {
      const code = await status(
        api.get("/store/approvals", generateStoreHeaders({ publishableKey }))
      );

      expect(code).toBe(401);
    });
  },
});
