import { convertToLocale } from "@/lib/util/money"
import { StoreBenefitBudget } from "@/types/benefit-budget"
import { CreditCard } from "@medusajs/icons"
import { Container, Heading, Text } from "@medusajs/ui"

/*

Medio de pago único del MVP: "Cargo beneficio Soprole" (provider
`pp_system_default`, sin pasarela). Muestra el saldo del mes y cómo queda
después de este pedido. El saldo lo valida de nuevo el backend al
confirmar (hook validate-cart-completion).

*/
const BenefitPayment = ({
  total,
  currencyCode,
  budget,
}: {
  total: number
  currencyCode: string
  budget: StoreBenefitBudget | null
}) => {
  const money = (amount: number) =>
    convertToLocale({ amount, currency_code: currencyCode })

  const after = budget ? budget.disponible - total : null

  return (
    <Container className="flex flex-col gap-y-3 p-5" data-testid="benefit-payment">
      <div className="flex items-center gap-x-2">
        <CreditCard />
        <Heading level="h2" className="text-base">
          Medio de pago
        </Heading>
      </div>
      <Text weight="plus">Cargo beneficio Soprole</Text>

      {budget ? (
        <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-sm">
          <dt className="text-ui-fg-subtle">Disponible este mes</dt>
          <dd data-testid="benefit-available">{money(budget.disponible)}</dd>
          <dt className="text-ui-fg-subtle">Este pedido</dt>
          <dd>− {money(total)}</dd>
          <dt className="text-ui-fg-subtle font-medium">Te quedará</dt>
          <dd
            className={after! < 0 ? "text-ui-fg-error font-medium" : "font-medium"}
            data-testid="benefit-after"
          >
            {money(Math.max(after!, 0))}
          </dd>
        </dl>
      ) : (
        <Text className="text-ui-fg-subtle text-sm">
          No pudimos cargar tu saldo de beneficio. Se validará al confirmar.
        </Text>
      )}
    </Container>
  )
}

export default BenefitPayment
