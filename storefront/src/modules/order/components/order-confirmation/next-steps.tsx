import { clx } from "@medusajs/ui"

/*

"¿Qué sigue?": los pasos del pedido después de confirmarlo, en lenguaje
simple para colaboradores de todas las edades. El primero ya está hecho.

Cuando exista el agendamiento (paso 3, pickup-scheduling), el paso de
retiro puede mostrar la fecha elegida.

*/
type Step = { title: string; description: string; done?: boolean }

const NextSteps = ({ siteName }: { siteName?: string | null }) => {
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
      description: siteName
        ? `Te avisaremos cuando puedas retirarlo en ${siteName}.`
        : "Te avisaremos cuando puedas retirarlo en la sala de venta.",
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
