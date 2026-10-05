import { HttpTypes } from "@medusajs/types"
import { Heading, Text } from "@medusajs/ui"

type OrderDetailsProps = {
  order: HttpTypes.StoreOrder
}

const OrderDetails = ({ order }: OrderDetailsProps) => {
  const createdAt = new Date(order.created_at)

  return (
    <>
      <Heading level="h3" className="mb-2">
        Detalles del pedido
      </Heading>

      <div className="text-sm text-ui-fg-subtle overflow-auto">
        <div className="flex justify-between">
          <Text>Número de pedido</Text>
          <Text>#{order.display_id}</Text>
        </div>

        <div className="flex justify-between mb-2">
          <Text>Fecha del pedido</Text>
          <Text>
            {" "}
            {createdAt.getDate()}-{createdAt.getMonth() + 1}-
            {createdAt.getFullYear()}
          </Text>
        </div>

        <Text>
          Hemos enviado los detalles de confirmación del pedido a{" "}
          <span className="font-semibold">{order.email}</span>.
        </Text>
      </div>
    </>
  )
}

export default OrderDetails
