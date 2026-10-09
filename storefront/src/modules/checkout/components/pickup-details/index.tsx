import { PickupSlots } from "@/lib/data/pickup-slots"
import { StoreStockLocation } from "@/lib/data/stock-locations"
import CheckoutCard from "@/modules/checkout/components/checkout-card"
import PickupDateSelector from "@/modules/checkout/components/pickup-date-selector"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import { MapPin } from "@medusajs/icons"

/*

"Retiro en sala": el site elegido en el carrito y la fecha de retiro.

El site se cambia en el carrito (ahí el backend mueve el carrito al canal
del site y revisa el stock), por eso acá solo hay un link de vuelta; al
cambiarlo, el backend borra la fecha elegida. La fecha se elige acá
(PickupDateSelector).

*/
const PickupDetails = ({
  site,
  slots,
  pickupDate,
  step,
}: {
  site: StoreStockLocation
  slots: PickupSlots | null
  pickupDate: string | null
  step?: number
}) => {
  const address = [site.address?.address_1, site.address?.city]
    .filter(Boolean)
    .join(", ")

  return (
    <CheckoutCard
      step={step}
      icon={<MapPin />}
      title="Retiro en sala"
      titleId="pickup-details-title"
      data-testid="pickup-details"
      action={
        <LocalizedClientLink
          href="/cart"
          className="rounded-full px-3 py-1.5 text-base font-medium text-blue-900 hover:bg-blue-50 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-900"
          data-testid="change-pickup-site-link"
          aria-label="Cambiar la sala de retiro"
        >
          Cambiar
        </LocalizedClientLink>
      }
    >
      <div className="flex flex-col gap-y-6">
        <div className="flex items-start gap-x-4 rounded-xl bg-[#FBF8F4] p-4">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FDE7EC] text-[#E01441]"
            aria-hidden="true"
          >
            <MapPin />
          </span>
          <div className="flex flex-col gap-y-0.5">
            <p
              className="text-lg font-semibold text-neutral-900"
              data-testid="pickup-site-name"
            >
              {site.name}
            </p>
            {address && (
              <p
                className="text-base text-neutral-600"
                data-testid="shipping-address-summary"
              >
                {address}
              </p>
            )}
          </div>
        </div>

        <PickupDateSelector
          slots={slots}
          selected={pickupDate}
          siteName={site.name}
        />
      </div>
    </CheckoutCard>
  )
}

export default PickupDetails
