import { formatPickupDate } from "@/lib/util/pickup-date"
import { clx } from "@medusajs/ui"

/*

"¿Qué sigue?": los pasos del pedido después de confirmarlo, en lenguaje
simple para colaboradores de todas las edades. El primero ya está hecho.

El paso de retiro muestra la fecha elegida en el checkout
(order.metadata.pickup_date), si la hay.

*/
type Step = { title: string; description: string; done?: boolean }

const NextSteps = ({
  siteName,
  pickupDate,
}: {
  siteName?: string | null
  pickupDate?: string | null
}) => {
  const where = siteName ? ` en ${siteName}` : " en la sala de venta"
  const steps: Step[] = [
    {
      title: "Pedido recibido",
      description: "Registramos tu pedido y lo descontamos de tu beneficio del mes.",
      done: true,
    },
    {
      title: "En preparación",
      description: "El equipo de la sala de venta prepara tus productos.",
    },
    {
      title: "Listo para retiro",
      description: pickupDate
        ? `Retíralo el ${formatPickupDate(pickupDate)}${where}. Te avisaremos cuando esté listo.`
        : `Te avisaremos cuando puedas retirarlo${where}.`,
    },
  ]

  return (
    <ol className="flex flex-col gap-y-0" aria-label="Próximos pasos de tu pedido">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1

        return (
          <li key={step.title} className="flex gap-x-4">
            <div className="flex flex-col items-center">
              <span
                className={clx(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                  step.done
                    ? "bg-[#E01441] text-white"
                    : "border-2 border-neutral-300 bg-white text-neutral-500"
                )}
                aria-hidden="true"
              >
                {step.done ? (
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none">
                    <path
                      d="M5 10.5l3 3 7-7"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  index + 1
                )}
              </span>
              {!isLast && <span className="my-1 w-0.5 flex-1 bg-neutral-200" aria-hidden="true" />}
            </div>
            <div className={clx("pb-6", isLast && "pb-0")}>
              <p className="text-base font-semibold text-neutral-900">
                {step.title}
                {step.done && <span className="sr-only"> (completado)</span>}
              </p>
              <p className="text-base text-neutral-600">{step.description}</p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export default NextSteps
