import { CartProvider } from "@/lib/context/cart-context"
import { retrieveCart } from "@/lib/data/cart"
import { retrieveCustomer } from "@/lib/data/customer"
import { listStockLocations } from "@/lib/data/stock-locations"
import CartTemplate from "@/modules/cart/templates"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Cart",
  description: "View your cart",
}

export default async function Cart() {
  const cart = await retrieveCart().catch(() => null)
  const customer = await retrieveCustomer()
  const stockLocations = await listStockLocations()

  return (
    <CartProvider cart={cart}>
      <CartTemplate customer={customer} stockLocations={stockLocations} />
    </CartProvider>
  )
}
