import { B2BCart, B2BCustomer } from "@/types"

/*

Aviso anticipado en carrito/checkout: ¿el total del carrito supera el saldo
de beneficio disponible del colaborador?

Es solo UX. La validación que manda es la del backend al completar el
carrito (hook validate-cart-completion + módulo benefit-budget), que además
cubre compras simultáneas. Si no hay saldo cargado (sin sesión o sin
campaña activa) devuelve false y deja que el backend responda.

Reemplaza a `check-spending-limit.ts` (cupo del B2B Starter) en el flujo
de compra.

*/
export function exceedsBenefitBudget(
  cart: Pick<B2BCart, "total"> | null | undefined,
  customer: B2BCustomer | null | undefined
): boolean {
  const budget = customer?.benefit_budget

  if (!cart || !budget) {
    return false
  }

  return (cart.total ?? 0) > budget.disponible
}
