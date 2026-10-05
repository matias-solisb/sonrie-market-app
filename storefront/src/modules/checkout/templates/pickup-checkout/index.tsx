import { StoreStockLocation } from "@/lib/data/stock-locations"
import { exceedsBenefitBudget } from "@/lib/util/check-benefit-budget"
import ItemsPreviewTemplate from "@/modules/cart/templates/preview"
import BenefitPayment from "@/modules/checkout/components/benefit-payment"
import CheckoutTotals from "@/modules/checkout/components/checkout-totals"
import ConfirmOrderButton from "@/modules/checkout/components/confirm-order-button"
import PickupDetails from "@/modules/checkout/components/pickup-details"
import Divider from "@/modules/common/components/divider"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import { B2BCart, B2BCustomer } from "@/types"
import { Container, Heading, Text } from "@medusajs/ui"

/*

Checkout de una sola página (MVP). Todo lo que el B2B Starter pedía en
pasos (dirección, facturación, despacho, contacto, medio de pago) ya viene
resuelto desde el carrito:
- site, dirección y "Retiro en {site}": POST /store/carts/:id/pickup-site;
- correo: el de la cuenta del colaborador;
- pago: "Cargo beneficio" (se crea al confirmar, ver confirmOrder).

Columna izquierda: retiro, datos del colaborador y medio de pago.
Columna derecha: productos, totales y "Confirmar pedido".

*/
const PickupCheckout = ({
  cart,
  customer,
  site,
}: {
  cart: B2BCart
  customer: B2BCustomer
  site: StoreStockLocation
}) => {
  const total = cart.total ?? 0
  const exceeds = exceedsBenefitBudget(cart, customer)
  const fullName = [customer.first_name, customer.last_name]
    .filter(Boolean)
    .join(" ")

  return (
    <div className="content-container py-8" data-testid="pickup-checkout">
      <div className="flex items-center justify-between mb-6">
        <Heading level="h1" className="text-2xl">
          Confirmar pedido
        </Heading>
        <LocalizedClientLink
          href="/cart"
          className="text-sm text-ui-fg-subtle hover:text-ui-fg-base"
        >
          ← Volver al carrito
        </LocalizedClientLink>
      </div>

      <div className="grid grid-cols-1 small:grid-cols-[1fr_416px] gap-4">
        <div className="flex flex-col gap-y-4">
          <PickupDetails site={site} />

          <Container className="flex flex-col gap-y-1 p-5" data-testid="customer-details">
            <Heading level="h2" className="text-base mb-2">
              Colaborador
            </Heading>
            {fullName && <Text weight="plus">{fullName}</Text>}
            <Text className="text-ui-fg-subtle">{cart.email || customer.email}</Text>
          </Container>

          <BenefitPayment
            total={total}
            currencyCode={cart.currency_code}
            budget={customer.benefit_budget ?? null}
          />
        </div>

        <div className="relative">
          <Container className="sticky top-4 flex flex-col p-5">
            <Heading level="h2" className="text-base mb-3">
              Tu pedido
            </Heading>
            <ItemsPreviewTemplate
              items={cart.items}
              currencyCode={cart.currency_code}
            />
            <Divider className="my-3" />
            <CheckoutTotals cartOrOrder={cart} />
            <Divider className="my-3" />
            <Text className="text-xs text-ui-fg-subtle mb-3">
              Al confirmar, el total se descuenta de tu beneficio del mes y
              el pedido queda para retiro en {site.name}.
            </Text>
            <ConfirmOrderButton
              disabled={exceeds}
              disabledReason={
                exceeds
                  ? "El pedido supera tu saldo de beneficio disponible. Vuelve al carrito y quita productos."
                  : undefined
              }
            />
          </Container>
        </div>
      </div>
    </div>
  )
}

export default PickupCheckout
