import { retrieveCart } from "@/lib/data/cart"
import { retrieveCustomer } from "@/lib/data/customer"
import { listPickupSlots } from "@/lib/data/pickup-slots"
import { listStockLocations } from "@/lib/data/stock-locations"
import PickupCheckout from "@/modules/checkout/templates/pickup-checkout"
import { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Confirmar pedido",
}

type Props = {
  params: Promise<{ countryCode: string }>
}

/*

Checkout de una sola página (ver PickupCheckout).

Se entra solo con el carrito listo; si no, se vuelve al carrito:
- sin carrito o sin productos;
- carrito de otro colaborador (ya no se acepta ?cartId=: el checkout solo
  trabaja con el carrito de la sesión);
- sin site de retiro confirmado (`metadata.stock_location_id` + método de
  retiro), que se elige con "Confirmar pedido" en el carrito.

Sin sesión, el middleware ya redirige al login.

*/
export default async function Checkout(props: Props) {
  const { countryCode } = await props.params
  const cartPath = `/${countryCode}/cart`

  const [cart, customer, sites] = await Promise.all([
    retrieveCart(),
    retrieveCustomer(),
    listStockLocations(),
  ])

  if (!customer) {
    redirect(`/${countryCode}/account?redirect_to=${encodeURIComponent(`/${countryCode}/checkout`)}`)
  }

  if (!cart || !cart.items?.length || cart.customer_id !== customer.id) {
    redirect(cartPath)
  }

  const siteId = cart.metadata?.stock_location_id as string | undefined
  const site = sites.find((s) => s.id === siteId)

  if (!site || !cart.shipping_methods?.length) {
    redirect(cartPath)
  }

  // Fechas de retiro del site (sin caché: los cupos cambian con cada compra).
  const slots = await listPickupSlots(site.id)

  return (
    <PickupCheckout cart={cart} customer={customer} site={site} slots={slots} />
  )
}
