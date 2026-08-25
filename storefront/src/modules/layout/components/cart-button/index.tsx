import { retrieveCart } from "@/lib/data/cart"
import CartDropdown from "../cart-dropdown"

export default async function CartButton() {
  const cart = await retrieveCart().catch(() => null)
  // retrieveCart() devuelve B2BCart | null (ver @/types/global) — el tipo
  // del prop `cart` en CartDropdown ya usa B2BCart, no HttpTypes.StoreCart.

  return <CartDropdown cart={cart} />
}
