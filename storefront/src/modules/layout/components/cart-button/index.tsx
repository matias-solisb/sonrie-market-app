import { retrieveCart } from "@/lib/data/cart"
import { retrieveCustomer } from "@/lib/data/customer"
import CartDropdown from "../cart-dropdown"

export default async function CartButton() {
  // retrieveCart() devuelve B2BCart | null (ver @/types/global) — el tipo
  // del prop `cart` en CartDropdown ya usa B2BCart, no HttpTypes.StoreCart.
  //
  // retrieveCustomer() valida la sesión contra el backend (no solo que
  // exista la cookie), así "Ir al carrito" manda a login también cuando el
  // token está vencido.
  const [cart, customer] = await Promise.all([
    retrieveCart().catch(() => null),
    retrieveCustomer().catch(() => null),
  ])

  return (
    <CartDropdown
      cart={cart}
      isAuthenticated={Boolean(customer)}
      benefitBudget={customer?.benefit_budget ?? null}
    />
  )
}
