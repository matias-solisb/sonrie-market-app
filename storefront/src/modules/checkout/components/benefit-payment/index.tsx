import { convertToLocale } from "@/lib/util/money"
import CheckoutCard from "@/modules/checkout/components/checkout-card"
import { StoreBenefitBudget } from "@/types/benefit-budget"
import { CreditCard } from "@medusajs/icons"
import { clx } from "@medusajs/ui"

/*

Medio de pago único del MVP: "Cargo beneficio Soprole" (provider
`pp_system_default`, sin pasarela). Muestra el saldo del mes y cómo queda
después de este pedido. El saldo lo valida de nuevo el backend al
confirmar (hook validate-cart-completion).

La barra muestra el tope del mes: lo ya usado (gris), este pedido (azul, o
rojo si se pasa) y lo que queda (vacío). Las cifras van debajo, así la barra
es solo apoyo visual (aria-hidden).

*/
const pct = (value: number, of: number) =>
  of > 0 ? Math.min(Math.max((value / of) * 100, 0), 100) : 0

const BenefitPayment = ({
  total,
  currencyCode,
  budget,
  step,
}: {
  total: number
  currencyCode: string
  budget: StoreBenefitBudget | null
  step?: number
}) => {
  const money = (amount: number) =>
    convertToLocale({ amount, currency_code: currencyCode })

  const after = budget ? budget.disponible - total : null
  const exceeds = after !== null && after < 0

  const usedPct = budget ? pct(budget.consumido, budget.tope) : 0
  const orderPct = budget
    ? Math.min(pct(total, budget.tope), 100 - usedPct)
    : 0

  return (
    <CheckoutCard
      step={step}
      icon={<CreditCard />}
      title="Medio de pago"
      titleId="benefit-payment-title"
      data-testid="benefit-payment"
    >
      <p className="mb-4 text-lg font-semibold text-neutral-900">
        Cargo beneficio Soprole
      </p>

      {budget ? (
        <div className="flex flex-col gap-y-4">
          {budget.tope > 0 && (
            <div aria-hidden="true">
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full bg-neutral-300"
                  style={{ width: `${usedPct}%` }}
                />
                <div
                  className={clx(
                    "h-full",
                    exceeds ? "bg-rose-500" : "bg-blue-900"
                  )}
                  style={{ width: `${orderPct}%` }}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-600">
                <span className="flex items-center gap-x-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
                  Ya usado
                </span>
                <span className="flex items-center gap-x-1.5">
                  <span
                    className={clx(
                      "h-2.5 w-2.5 rounded-full",
                      exceeds ? "bg-rose-500" : "bg-blue-900"
                    )}
                  />
                  Este pedido
                </span>
                <span className="flex items-center gap-x-1.5">
                  <span className="h-2.5 w-2.5 rounded-full border border-neutral-300 bg-neutral-100" />
                  Te queda
                </span>
              </div>
            </div>
          )}

          <dl className="grid grid-cols-[1fr_auto] gap-y-2 text-base">
            <dt className="text-neutral-600">Disponible este mes</dt>
            <dd className="text-right text-neutral-900" data-testid="benefit-available">
              {money(budget.disponible)}
            </dd>
            <dt className="text-neutral-600">Este pedido</dt>
            <dd className="text-right text-neutral-900">− {money(total)}</dd>
            <dt className="mt-1 border-t border-neutral-200 pt-3 font-semibold text-neutral-900">
              Te quedará
            </dt>
            <dd
              className={clx(
                "mt-1 border-t border-neutral-200 pt-3 text-right text-lg font-bold",
                exceeds ? "text-rose-600" : "text-neutral-900"
              )}
              data-testid="benefit-after"
            >
              {money(Math.max(after!, 0))}
            </dd>
          </dl>
        </div>
      ) : (
        <p className="rounded-xl bg-neutral-50 px-4 py-3 text-base text-neutral-700">
          No pudimos cargar tu saldo de beneficio. Se validará al confirmar.
        </p>
      )}
    </CheckoutCard>
  )
}

export default BenefitPayment
