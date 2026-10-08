import { HttpTypes } from "@medusajs/types"
import { formatPickupDate, isPickupDate } from "@/lib/util/pickup-date"
import { Heading, Text } from "@medusajs/ui"

type ShippingDetailsProps = {
  order: HttpTypes.StoreOrder
}

const ShippingDetails = ({ order }: ShippingDetailsProps) => {
  const pickupDate = isPickupDate(order.metadata?.pickup_date)
    ? (order.metadata?.pickup_date as string)
    : null

  // order.shipping_address = {
  //   first_name: "Riqwan",
  //   last_name: "Thamir",
  //   address_1: "11c heidestrasse",
  //   address_2: "Berlin - 10557",
  //   country_code: "DE",
  //   postal_code: "10557",
  //   city: "Berlin",
  //   company: "MedusaJS Aps",
  // }
  // order.billing_address = {
  //   first_name: "Riqwan",
  //   last_name: "Thamir",
  //   address_1: "11c heidestrasse",
  //   address_2: "Berlin - 10557",
  //   country_code: "DE",
  //   postal_code: "10557",
  //   city: "Berlin",
  // }
  // order.shipping_methods = [
  //   {
  //     name: "Webshiper",
  //     total: 1055,
  //   },
  // ]
  return (
    !!order.shipping_address && (
      <>
        <Heading level="h3" className="mb-2">
          Dirección de retiro
        </Heading>

        {!!order.shipping_address && (
          <div>
            <Text className="txt-medium text-ui-fg-subtle capitalize">
              {order.shipping_address?.company}
            </Text>
            <Text className="txt-medium text-ui-fg-subtle capitalize">
              {order.shipping_address?.first_name}{" "}
              {order.shipping_address?.last_name}
            </Text>
            <Text className="txt-medium text-ui-fg-subtle capitalize">
              {order.shipping_address?.phone}
            </Text>
            <Text className="txt-medium text-ui-fg-subtle">
              {order.shipping_address?.address_1}{" "}
              {order.shipping_address?.address_2}
            </Text>
            <Text className="txt-medium text-ui-fg-subtle">
              {order.shipping_address?.postal_code},{" "}
              {order.shipping_address?.city},{" "}
              {order.shipping_address?.province},{" "}
              {order.shipping_address?.country_code?.toUpperCase()}
            </Text>
          </div>
        )}

        {pickupDate && (
          <Text
            className="txt-medium text-ui-fg-base mt-2"
            data-testid="order-pickup-date"
          >
            Fecha de retiro: {formatPickupDate(pickupDate)}
          </Text>
        )}
      </>
    )
  )
}

export default ShippingDetails
