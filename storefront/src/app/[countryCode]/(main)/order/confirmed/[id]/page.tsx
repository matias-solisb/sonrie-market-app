import { retrieveBenefitBudget } from "@/lib/data/customer"
import { retrieveOrder } from "@/lib/data/orders"
import OrderCompletedTemplate from "@/modules/order/templates/order-completed-template"
import { B2BOrder } from "@/types/global"
import { Metadata } from "next"
import { notFound } from "next/navigation"

type Props = {
  params: Promise<{ id: string }>
}

export const metadata: Metadata = {
  title: "Pedido confirmado",
  description: "Tu pedido fue realizado con éxito",
}

export default async function OrderConfirmedPage(props: Props) {
  const params = await props.params
  const [order, benefitBudget] = await Promise.all([
    retrieveOrder(params.id).catch(() => null) as Promise<B2BOrder | null>,
    retrieveBenefitBudget(),
  ])

  if (!order) {
    return notFound()
  }

  return <OrderCompletedTemplate order={order} benefitBudget={benefitBudget} />
}
