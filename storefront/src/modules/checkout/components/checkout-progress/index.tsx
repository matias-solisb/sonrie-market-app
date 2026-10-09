import { CheckMini } from "@medusajs/icons"
import { clx } from "@medusajs/ui"

/*

Indicador de avance del checkout: Carrito (listo) → Confirmar (aquí) →
¡Listo! (confirmación). Solo orienta; no es navegable.

*/
const STEPS = [
  { label: "Carrito", state: "done" },
  { label: "Confirmar", state: "current" },
  { label: "¡Listo!", state: "next" },
] as const

const CheckoutProgress = () => (
  <nav aria-label="Avance de tu compra">
    <ol className="flex items-center gap-x-2 text-sm small:text-base">
      {STEPS.map((step, i) => (
        <li key={step.label} className="flex items-center gap-x-2">
          {i > 0 && (
            <span
              className={clx(
                "h-0.5 w-6 rounded-full small:w-10",
                step.state === "next" ? "bg-neutral-300" : "bg-blue-900"
              )}
              aria-hidden="true"
            />
          )}
          <span
            className="flex items-center gap-x-2"
            aria-current={step.state === "current" ? "step" : undefined}
          >
            <span
              className={clx(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                step.state === "done" && "bg-blue-900 text-white",
                step.state === "current" &&
                  "bg-white text-blue-900 ring-2 ring-blue-900",
                step.state === "next" &&
                  "bg-white text-neutral-500 ring-1 ring-neutral-300"
              )}
              aria-hidden="true"
            >
              {step.state === "done" ? <CheckMini /> : i + 1}
            </span>
            <span
              className={clx(
                step.state === "current"
                  ? "font-semibold text-neutral-900"
                  : step.state === "done"
                    ? "text-neutral-700"
                    : "text-neutral-500"
              )}
            >
              {step.label}
              {step.state === "done" && (
                <span className="sr-only"> (completado)</span>
              )}
            </span>
          </span>
        </li>
      ))}
    </ol>
  </nav>
)

export default CheckoutProgress
