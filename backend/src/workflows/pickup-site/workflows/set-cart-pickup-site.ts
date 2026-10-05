import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import {
  addShippingMethodToCartWorkflow,
  updateCartWorkflow,
} from "@medusajs/medusa/core-flows";
import {
  findUnavailableCartItemsStep,
  prepareCartPickupSiteStep,
  PrepareCartPickupSiteInput,
} from "../steps";

/*

Elige el site de retiro del carrito. Lo usa POST /store/carts/:id/pickup-site
cuando el colaborador confirma el carrito.

1. Valida carrito y site.
2. Pasa el carrito al sales channel del site (el stock se reserva solo en
   esa sala), con la dirección del site como envío y facturación, el
   correo del colaborador y `metadata.stock_location_id`.
3. Agrega la opción "Retiro en {site}" como método de envío (reemplaza la
   que hubiera).
4. Devuelve los ítems sin stock suficiente en el site, para avisar antes
   del checkout.

Si un paso falla, los anteriores se compensan (el carrito vuelve a como
estaba).

*/
export const setCartPickupSiteWorkflow = createWorkflow(
  "set-cart-pickup-site",
  function (input: PrepareCartPickupSiteInput) {
    const prepared = prepareCartPickupSiteStep(input);

    const cartUpdate = transform({ prepared }, ({ prepared }) => prepared.cart_update);

    updateCartWorkflow.runAsStep({ input: cartUpdate });

    const shippingInput = transform({ prepared }, ({ prepared }) => ({
      cart_id: prepared.cart_update.id,
      options: [{ id: prepared.site.shipping_option_id }],
    }));

    addShippingMethodToCartWorkflow.runAsStep({ input: shippingInput });

    const availabilityInput = transform({ prepared }, ({ prepared }) => ({
      cart_id: prepared.cart_update.id,
      sales_channel_id: prepared.site.sales_channel_id,
    }));

    const unavailableItems = findUnavailableCartItemsStep(availabilityInput);

    const result = transform(
      { prepared, unavailableItems },
      ({ prepared, unavailableItems }) => ({
        site: prepared.site,
        unavailable_items: unavailableItems,
      })
    );

    return new WorkflowResponse(result);
  }
);
