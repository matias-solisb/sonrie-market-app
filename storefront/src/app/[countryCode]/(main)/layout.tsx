import { retrieveCart } from "@/lib/data/cart"
import { isProfileBannerDismissed } from "@/lib/data/cookies"
import {
  enforceAccountState,
  retrieveCustomer,
} from "@/lib/data/customer"
import { listCartFreeShippingPrices } from "@/lib/data/fulfillment"
import { getBaseURL } from "@/lib/util/env"
import CartMismatchBanner from "@/modules/layout/components/cart-mismatch-banner"
import ProfileIncompleteBanner from "@/modules/layout/components/profile-incomplete-banner"
import Footer from "@/modules/layout/templates/footer"
import { NavigationHeader } from "@/modules/layout/templates/nav"
import FreeShippingPriceNudge from "@/modules/shipping/components/free-shipping-price-nudge"
import { StoreFreeShippingPrice } from "@/types/shipping-option/http"
import { Metadata } from "next"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

export default async function PageLayout(props: {
  children: React.ReactNode
  params: Promise<{ countryCode: string }>
}) {
  // Cuenta deshabilitada → se cierra la sesión; clave inicial sin cambiar →
  // /cambiar-clave (rut-auth, pasos 6 y 9). Va antes de cargar el carrito,
  // que el backend bloquea en ambos casos.
  const { countryCode } = await props.params
  await enforceAccountState(countryCode)

  const customer = await retrieveCustomer().catch(() => null)
  const cart = await retrieveCart()
  let freeShippingPrices: StoreFreeShippingPrice[] = []

  if (cart) {
    freeShippingPrices = await listCartFreeShippingPrices(cart.id)
  }

  return (
    <>
      <NavigationHeader />

      {/* La barra promocional de fábrica del B2B Starter ("Build your own
          B2B store with this starter") se quitó: no combina con la marca de
          Sonríe Market. En su lugar, para un customer con categorías, ya
          queda visible justo debajo del header la barra roja de
          "Categorías de productos" que renderiza NavigationHeader. */}

      {/* Datos del perfil que faltan (lib/util/profile-completion.ts). */}
      {customer && (
        <ProfileIncompleteBanner
          customer={customer}
          initiallyDismissed={await isProfileBannerDismissed(customer.id)}
        />
      )}

      {customer && cart && (
        <CartMismatchBanner customer={customer} cart={cart} />
      )}

      {props.children}

      <Footer />

      {cart && freeShippingPrices && (
        <FreeShippingPriceNudge
          variant="popup"
          cart={cart}
          freeShippingPrices={freeShippingPrices}
        />
      )}
    </>
  )
}
