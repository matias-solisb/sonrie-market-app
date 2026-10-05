import { convertToLocale } from "@/lib/util/money"
import { B2BCustomer } from "@/types/global"
import { Badge, Container, Text } from "@medusajs/ui"

/*

Panel "Crédito" de "Mis datos". Muestra el saldo de beneficio del periodo
vigente: `customer.benefit_budget`, que `retrieveCustomer`
(`lib/data/customer.ts`) trae de `GET /store/benefit-budget` (módulo
benefit-budget del backend). Total = tope del mes (incluye una excepción
fijada por el Admin, si la hay); Crédito restante = disponible.

Ya no se calcula acá sumando pedidos (`employee.spending_limit` del B2B
Starter): el backend lleva el consumo y descuenta los pedidos anulados.

Los separadores entre secciones siguen el mismo patrón que `ProfileCard`
(`DIVIDER_CLASS_STANDALONE` ahí): NO son un `border-b` en el div de la
sección, sino un div de 1px propio puesto como HERMANO después de esa
sección, para que la línea quede corta (no toque el borde derecho) igual
que en "Mis datos".

*/

const DIVIDER_CLASS = "h-px bg-neutral-200 ml-6 mr-10"

const CreditPanel = ({ customer }: { customer: B2BCustomer }) => {
  const budget = customer.benefit_budget ?? null
  const hasCreditLine = Boolean(budget)
  const currencyCode = "clp"

  return (
    <div className="h-fit">
      {/*
        Spacer invisible que replica el alto del encabezado "Mis datos" /
        "Editar Datos" de `ProfileCard` (que vive fuera de su recuadro).
        Tiene que quedar con las MISMAS clases de tamaño que ese encabezado
        (hoy: text-2xl font-bold + mb-4 + gap-x-4) para que el borde
        superior de este panel siga alineado con el borde superior del
        recuadro de "Mis datos" — si cambias el tamaño de esa línea allá
        (`profile-card/index.tsx`), replica el cambio acá.
      */}
      <div
        className="hidden small:flex items-center gap-x-4 mb-4 invisible"
        aria-hidden="true"
      >
        <Text className="text-2xl font-bold">Crédito</Text>
      </div>

      <Container className="p-0 overflow-hidden">
        <div className="flex items-center justify-between p-6">
          <Text size="large" className="font-semibold text-blue-900">
            Crédito
          </Text>
          {hasCreditLine ? (
            <Badge color="green" size="base">
              Disponible
            </Badge>
          ) : (
            <Badge color="grey" size="base">
              Sin asignar
            </Badge>
          )}
        </div>
        <div className={DIVIDER_CLASS} />

        <div className="flex flex-col gap-y-4 p-6">
          <div className="flex items-center justify-between">
            <Text size="large" className="text-neutral-500">
              Total
            </Text>
            <Text size="large" className="font-medium text-neutral-950">
              {hasCreditLine
                ? convertToLocale({
                    amount: budget!.tope,
                    currency_code: currencyCode,
                  })
                : "—"}
            </Text>
          </div>
          <div className="flex items-center justify-between">
            <Text size="large" className="text-neutral-500">
              Crédito restante:
            </Text>
            <Text size="large" className="font-medium text-neutral-950">
              {hasCreditLine
                ? convertToLocale({
                    amount: budget!.disponible,
                    currency_code: currencyCode,
                  })
                : "—"}
            </Text>
          </div>
        </div>
        <div className={DIVIDER_CLASS} />

        <div className="flex flex-col gap-y-3 p-6">
          <Text size="large" className="font-semibold text-blue-900">
            Vendedores asignados
          </Text>
          {/*
            TODO: no existe todavía ninguna entidad de "vendedor asignado"
            en el modelo company/employee (ver especificación técnica,
            módulos `employee-sync`/`sap-orders`, Fase 4). Reemplazar este
            estado vacío por el listado real cuando ese dato llegue desde
            SAP.
          */}
          <Text className="text-neutral-500 text-sm">
            Aún no hay vendedores asignados a tu cuenta.
          </Text>
        </div>
      </Container>
    </div>
  )
}

export default CreditPanel
