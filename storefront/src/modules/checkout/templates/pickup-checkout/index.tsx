import { PickupSlots } from "@/lib/data/pickup-slots"
import { StoreStockLocation } from "@/lib/data/stock-locations"
import { exceedsBenefitBudget } from "@/lib/util/check-benefit-budget"
import { formatPickupDate, isPickupDate } from "@/lib/util/pickup-date"
import ItemsPreviewTemplate from "@/modules/cart/templates/preview"
import BenefitPayment from "@/modules/checkout/components/benefit-payment"
import CheckoutCard from "@/modules/checkout/components/checkout-card"
import CheckoutProgress from "@/modules/checkout/components/checkout-progress"
import CheckoutTotals from "@/modules/checkout/components/checkout-totals"
import ConfirmOrderButton from "@/modules/checkout/components/confirm-order-button"
import PickupDetails from "@/modules/checkout/components/pickup-details"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import { B2BCart, B2BCustomer } from "@/types"
import { ArrowLeft, Heart, InformationCircleSolid, ShoppingBag, User } from "@medusajs/icons"

/*

Checkout de una sola página (MVP). Todo lo que el B2B Starter pedía en
pasos (dirección, facturación, despacho, contacto, medio de pago) ya viene
resuelto desde el carrito:
- site, dirección y "Retiro en {site}": POST /store/carts/:id/pickup-site;
- fecha de retiro: se elige acá (PickupDetails → POST
  /store/carts/:id/pickup-date). Sin una fecha con cupo no se puede
  confirmar;
- correo: el de la cuenta del colaborador;
- pago: "Cargo beneficio" (se crea al confirmar, ver confirmOrder).

Columna izquierda, en bloques numerados: 1 retiro, 2 datos del
colaborador, 3 medio de pago. Columna derecha: productos, totales y
"Confirmar pedido".

Diseño: el mismo de la confirmación del pedido (fondo crema, tarjetas
redondeadas, letra grande), pensado para colaboradores de todas las
edades. Azul para las acciones, rojo de marca para íconos y detalles.

*/
const PickupCheckout = ({
  cart,
  customer,
  site,
  slots,
}: {
  cart: B2BCart
  customer: B2BCustomer
  site: StoreStockLocation
  slots: PickupSlots | null
}) => {
  const total = cart.total ?? 0
  const exceeds = exceedsBenefitBudget(cart, customer)
  const savedDate = cart.metadata?.pickup_date
  const pickupDate = isPickupDate(savedDate) ? savedDate : null
  // La fecha guardada vale solo si sigue con cupo (el backend lo vuelve a
  // validar al confirmar).
  const hasValidDate =
    !!pickupDate &&
    !!slots?.fechas.some((f) => f.fecha === pickupDate && f.disponible)
  const firstName = customer.first_name?.trim()
  const fullName = [customer.first_name, customer.last_name]
    .filter(Boolean)
    .join(" ")
  const email = cart.email || customer.email
  const units = (cart.items ?? []).reduce(
    (sum, item) => sum + Number(item.quantity),
    0
  )

  return (
    <div
      className="content-container py-8 small:py-12"
      data-testid="pickup-checkout"
    >
      <header className="mb-8 flex flex-col gap-y-5">
        <LocalizedClientLink
          href="/cart"
          className="-ml-3 inline-flex w-fit items-center gap-x-2 rounded-full px-3 py-2 text-base text-neutral-700 transition-colors hover:bg-white hover:text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-900"
        >
          <ArrowLeft aria-hidden="true" />
          Volver al carrito
        </LocalizedClientLink>

        <div className="flex flex-col gap-y-5 small:flex-row small:items-end small:justify-between">
          <div className="flex flex-col gap-y-2">
            <h1 className="text-3xl font-bold text-neutral-900 small:text-4xl">
              Confirmar pedido
            </h1>
            <p className="text-lg text-neutral-700">
              {firstName ? `Hola, ${firstName}. ` : ""}Revisa tu pedido y elige
              cuándo retirarlo.
            </p>
          </div>
          <CheckoutProgress />
        </div>
      </header>

      <div className="grid grid-cols-1 items-start gap-6 small:grid-cols-[1fr_420px]">
        <div className="flex flex-col gap-y-6">
          <PickupDetails
            step={1}
            site={site}
            slots={slots}
            pickupDate={pickupDate}
          />

          <CheckoutCard
            step={2}
            icon={<User />}
            title="Tus datos"
            titleId="customer-details-title"
            data-testid="customer-details"
          >
            <div className="flex items-center gap-x-4">
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-lg font-bold uppercase text-blue-900"
                aria-hidden="true"
              >
                {(firstName || email || "?").charAt(0)}
              </span>
              <div className="flex min-w-0 flex-col">
                {fullName && (
                  <p className="text-lg font-semibold text-neutral-900">
                    {fullName}
                  </p>
                )}
                <p className="truncate text-base text-neutral-600">{email}</p>
              </div>
            </div>
          </CheckoutCard>

          <BenefitPayment
            step={3}
            total={total}
            currencyCode={cart.currency_code}
            budget={customer.benefit_budget ?? null}
          />
        </div>

        <aside className="small:sticky small:top-6" aria-label="Resumen del pedido">
          <CheckoutCard
            icon={<ShoppingBag />}
            title="Tu pedido"
            titleId="order-summary-title"
            action={
              <span className="rounded-full bg-neutral-100 px-3 py-1 text-sm font-medium text-neutral-700">
                {units} {units === 1 ? "producto" : "productos"}
              </span>
            }
          >
            <ItemsPreviewTemplate
              items={cart.items}
              currencyCode={cart.currency_code}
              size="large"
            />
            <div className="my-4 border-t border-neutral-200" />
            <CheckoutTotals cartOrOrder={cart} highlightTotal />

            <p className="my-4 flex items-start gap-x-2 text-sm text-neutral-600">
              <InformationCircleSolid
                className="mt-0.5 shrink-0 text-neutral-400"
                aria-hidden="true"
              />
              <span>
                Al confirmar, el total se descuenta de tu beneficio del mes y
                el pedido queda para retiro en {site.name}
                {hasValidDate && pickupDate
                  ? ` el ${formatPickupDate(pickupDate)}`
                  : ""}
                .
              </span>
            </p>

            <ConfirmOrderButton
              disabled={exceeds || !hasValidDate}
              disabledReason={
                exceeds
                  ? "El pedido supera tu saldo de beneficio disponible. Vuelve al carrito y quita productos."
                  : !hasValidDate
                    ? "Elige una fecha de retiro para confirmar el pedido."
                    : undefined
              }
            />
          </CheckoutCard>

          <p className="mt-4 flex items-center justify-center gap-x-2 text-center text-base text-neutral-600">
            <Heart className="shrink-0 text-[#E01441]" aria-hidden="true" />
            Gracias por ser parte de Sonríe Market.
          </p>
        </aside>
      </div>
    </div>
  )
}

export default PickupCheckout
