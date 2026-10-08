import { convertToLocale } from "@/lib/util/money"
import { formatPickupDate, isPickupDate } from "@/lib/util/pickup-date"
import CheckoutTotals from "@/modules/checkout/components/checkout-totals"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import NextSteps from "@/modules/order/components/order-confirmation/next-steps"
import SuccessCheck from "@/modules/order/components/order-confirmation/success-check"
import Thumbnail from "@/modules/products/components/thumbnail"
import { StoreBenefitBudget } from "@/types/benefit-budget"
import { CreditCard, MapPin } from "@medusajs/icons"
import { B2BOrder } from "@/types/global"

/*

Confirmación del pedido (/order/confirmed/:id).

Pensada para colaboradores de todas las edades: textos simples, letra
grande, buen contraste y un solo foco por bloque.

1. Check rojo de marca + "¡Gracias!" + número y fecha del pedido.
2. "¿Qué sigue?": pedido recibido → en preparación → listo para retiro.
3. Retiro (site) y pago (Cargo beneficio, con el saldo que queda).
4. Resumen del pedido: productos y totales.
5. Acciones: ver mis pedidos / seguir comprando, y ayuda.

*/
type OrderCompletedTemplateProps = {
  order: B2BOrder
  benefitBudget?: StoreBenefitBudget | null
}

const BRAND_RED = "#E01441"

const formatDate = (value: string | Date) =>
  new Intl.DateTimeFormat("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Santiago",
  }).format(new Date(value))

const Card = ({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLElement>) => (
  <section
    className={`rounded-2xl border border-neutral-200 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${className}`}
    {...props}
  >
    {children}
  </section>
)

export default async function OrderCompletedTemplate({
  order,
  benefitBudget,
}: OrderCompletedTemplateProps) {
  const firstName = order.shipping_address?.first_name?.trim()
  const siteName = order.shipping_address?.company
  const pickupDate = isPickupDate(order.metadata?.pickup_date)
    ? (order.metadata?.pickup_date as string)
    : null
  const siteAddress = [order.shipping_address?.address_1, order.shipping_address?.city]
    .filter(Boolean)
    .join(", ")
  const money = (amount: number) =>
    convertToLocale({ amount, currency_code: order.currency_code })
  const items = [...(order.items ?? [])].sort((a, b) =>
    (a.created_at ?? "") > (b.created_at ?? "") ? 1 : -1
  )
  const units = items.reduce((sum, item) => sum + Number(item.quantity), 0)

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#FBF8F4] py-10 small:py-14">
      <div
        className="content-container flex max-w-3xl flex-col gap-y-6"
        data-testid="order-complete-container"
      >
        {/* 1. Agradecimiento */}
        <Card className="flex flex-col items-center gap-y-5 px-6 py-10 text-center">
          <SuccessCheck />
          <div className="flex flex-col gap-y-2">
            <h1 className="text-3xl font-bold text-neutral-900 small:text-4xl">
              ¡Gracias{firstName && firstName !== "-" ? `, ${firstName}` : ""}!
            </h1>
            <p className="text-lg text-neutral-700">
              Su pedido fue realizado con éxito.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 text-base">
            <span
              className="rounded-full px-4 py-1.5 font-semibold text-white"
              style={{ backgroundColor: BRAND_RED }}
              data-testid="order-display-id"
            >
              Pedido #{order.display_id}
            </span>
            <span className="rounded-full bg-neutral-100 px-4 py-1.5 text-neutral-700">
              {formatDate(order.created_at)}
            </span>
          </div>
          {order.email && (
            <p className="max-w-md text-base text-neutral-600">
              Te escribiremos a{" "}
              <span className="font-semibold text-neutral-800">{order.email}</span>{" "}
              cuando tu pedido esté listo para retirar.
            </p>
          )}
        </Card>

        {/* 2. Próximos pasos */}
        <Card aria-labelledby="next-steps-title">
          <h2 id="next-steps-title" className="mb-5 text-xl font-semibold text-neutral-900">
            ¿Qué sigue?
          </h2>
          <NextSteps siteName={siteName} pickupDate={pickupDate} />
        </Card>

        {/* 3. Retiro y pago */}
        <div className="grid grid-cols-1 gap-6 xsmall:grid-cols-2">
          <Card aria-labelledby="pickup-title" data-testid="order-pickup">
            <div className="mb-3 flex items-center gap-x-2 text-[#E01441]">
              <MapPin />
              <h2 id="pickup-title" className="text-base font-semibold text-neutral-900">
                Retiro en sala
              </h2>
            </div>
            {siteName && (
              <p className="text-lg font-semibold text-neutral-900">{siteName}</p>
            )}
            {siteAddress && <p className="text-base text-neutral-600">{siteAddress}</p>}
            {pickupDate && (
              <p
                className="mt-2 text-base font-semibold text-neutral-900"
                data-testid="order-pickup-date"
              >
                Retiro el {formatPickupDate(pickupDate)}
              </p>
            )}
          </Card>

          <Card aria-labelledby="payment-title" data-testid="order-payment">
            <div className="mb-3 flex items-center gap-x-2 text-[#E01441]">
              <CreditCard />
              <h2 id="payment-title" className="text-base font-semibold text-neutral-900">
                Pago
              </h2>
            </div>
            <p className="text-lg font-semibold text-neutral-900">
              Cargo beneficio Soprole
            </p>
            <p className="text-base text-neutral-600">
              Se descontaron {money(order.total ?? 0)}.
            </p>
            {benefitBudget && (
              <p className="mt-2 text-base text-neutral-600">
                Te quedan{" "}
                <span className="font-semibold text-neutral-900">
                  {money(benefitBudget.disponible)}
                </span>{" "}
                este mes.
              </p>
            )}
          </Card>
        </div>

        {/* 4. Resumen */}
        <Card aria-labelledby="summary-title">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 id="summary-title" className="text-xl font-semibold text-neutral-900">
              Resumen del pedido
            </h2>
            <span className="text-base text-neutral-500">
              {units} {units === 1 ? "producto" : "productos"}
            </span>
          </div>

          <ul className="divide-y divide-neutral-100" data-testid="order-items">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-x-4 py-3">
                <Thumbnail
                  thumbnail={item.thumbnail}
                  size="square"
                  className="!w-16 shrink-0 !p-0 !shadow-none"
                />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-base font-medium text-neutral-900">
                    {item.product_title || item.title}
                  </p>
                  <p className="text-sm text-neutral-500">
                    {item.quantity} × {money(item.unit_price ?? 0)}
                  </p>
                </div>
                <p className="text-base font-semibold text-neutral-900">
                  {money(item.total ?? 0)}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-4 overflow-hidden rounded-xl bg-neutral-50 p-4 text-base">
            <CheckoutTotals cartOrOrder={order} />
          </div>
        </Card>

        {/* 5. Acciones */}
        <div className="flex flex-col gap-3 xsmall:flex-row">
          <LocalizedClientLink
            href="/account/orders"
            className="flex h-12 w-full xsmall:flex-1 items-center justify-center rounded-xl text-base font-bold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: BRAND_RED }}
            data-testid="go-to-orders-button"
          >
            Ver mis pedidos
          </LocalizedClientLink>
          <LocalizedClientLink
            href="/store"
            className="flex h-12 w-full xsmall:flex-1 items-center justify-center rounded-xl border-2 border-neutral-300 bg-white text-base font-bold text-neutral-800 transition-colors hover:border-neutral-400"
          >
            Seguir comprando
          </LocalizedClientLink>
        </div>

        <p className="text-center text-base text-neutral-600">
          Gracias por ser parte de la familia Sonríe Market.
          <br />
          ¿Necesitas ayuda?{" "}
          <LocalizedClientLink
            href="/contact"
            className="font-semibold text-[#E01441] underline-offset-2 hover:underline"
          >
            Contáctanos
          </LocalizedClientLink>
        </p>
      </div>
    </div>
  )
}
