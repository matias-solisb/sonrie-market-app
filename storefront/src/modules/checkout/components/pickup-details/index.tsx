import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import { StoreStockLocation } from "@/lib/data/stock-locations"
import { MapPin } from "@medusajs/icons"
import { Container, Heading, Text } from "@medusajs/ui"

/*

"Retiro en sala": el site elegido en el carrito. Se cambia en el carrito
(ahí el backend mueve el carrito al canal del site y revisa el stock), por
eso acá solo hay un link de vuelta.

Paso 3 (pickup-scheduling): acá va el selector de fecha de retiro.

*/
const PickupDetails = ({ site }: { site: StoreStockLocation }) => {
  const address = [site.address?.address_1, site.address?.city]
    .filter(Boolean)
    .join(", ")

  return (
    <Container className="flex flex-col gap-y-3 p-5" data-testid="pickup-details">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-x-2">
          <MapPin />
          <Heading level="h2" className="text-base">
            Retiro en sala
          </Heading>
        </div>
        <LocalizedClientLink
          href="/cart"
          className="text-sm text-ui-fg-interactive hover:underline"
          data-testid="change-pickup-site-link"
        >
          Cambiar
        </LocalizedClientLink>
      </div>
      <div>
        <Text weight="plus" data-testid="pickup-site-name">
          {site.name}
        </Text>
        {address && (
          <Text className="text-ui-fg-subtle" data-testid="shipping-address-summary">
            {address}
          </Text>
        )}
      </div>
    </Container>
  )
}

export default PickupDetails
