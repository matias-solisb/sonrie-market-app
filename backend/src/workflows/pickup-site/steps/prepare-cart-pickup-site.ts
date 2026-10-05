import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils";
import { getPickupSite, PickupSite } from "../../../utils/pickup-sites";

export type PrepareCartPickupSiteInput = {
  cart_id: string;
  customer_id: string;
  stock_location_id: string;
};

export type PrepareCartPickupSiteOutput = {
  site: PickupSite;
  cart_update: {
    id: string;
    sales_channel_id: string;
    email?: string;
    shipping_address: Record<string, string>;
    billing_address: Record<string, string>;
    metadata: Record<string, unknown>;
  };
};

/*

Valida que el carrito sea del colaborador y que el site exista y esté
configurado, y arma los datos que se le escriben al carrito: canal del
site, dirección del site como envío y facturación, correo del colaborador
y `metadata.stock_location_id`.

Solo lee; no tiene compensación.

*/
export const prepareCartPickupSiteStep = createStep(
  "prepare-cart-pickup-site",
  async (input: PrepareCartPickupSiteInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    const {
      data: [cart],
    } = await query.graph({
      entity: "cart",
      fields: ["id", "customer_id", "completed_at", "email", "metadata"],
      filters: { id: input.cart_id },
    });

    // Mismo error si no existe o es de otro colaborador: no revelar ids.
    if (!cart || cart.customer_id !== input.customer_id) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `Carrito ${input.cart_id} no encontrado.`
      );
    }

    if (cart.completed_at) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Este carrito ya se convirtió en un pedido."
      );
    }

    const site = await getPickupSite(query, input.stock_location_id);

    if (!site) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "El site de retiro elegido no está disponible."
      );
    }

    const {
      data: [customer],
    } = await query.graph({
      entity: "customer",
      fields: ["email", "first_name", "last_name", "phone"],
      filters: { id: input.customer_id },
    });

    const address = {
      first_name: customer?.first_name || site.name,
      last_name: customer?.last_name || "-",
      company: site.name,
      address_1: site.address?.address_1 || site.name,
      address_2: site.address?.address_2 || "",
      city: site.address?.city || "",
      province: site.address?.province || "",
      postal_code: site.address?.postal_code || "",
      country_code: (site.address?.country_code || "cl").toLowerCase(),
      phone: customer?.phone || "",
    };

    return new StepResponse<PrepareCartPickupSiteOutput>({
      site,
      cart_update: {
        id: cart.id,
        sales_channel_id: site.sales_channel_id,
        email: cart.email || customer?.email || undefined,
        shipping_address: address,
        billing_address: address,
        metadata: {
          ...((cart.metadata as Record<string, unknown>) ?? {}),
          stock_location_id: site.id,
        },
      },
    });
  }
);
