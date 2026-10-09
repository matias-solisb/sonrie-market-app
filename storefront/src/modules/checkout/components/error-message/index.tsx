import { ExclamationCircleSolid } from "@medusajs/icons"

/*

Mensaje de error. `variant="box"` (checkout de retiro) lo muestra en un
recuadro con ícono, más visible; el resto de la app usa el texto simple.

*/
const ErrorMessage = ({
  error,
  variant = "text",
  "data-testid": dataTestid,
}: {
  error?: string | null
  variant?: "text" | "box"
  "data-testid"?: string
}) => {
  if (!error) {
    return null
  }

  if (variant === "box") {
    return (
      <div
        role="alert"
        className="flex items-start gap-x-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-base text-rose-700"
        data-testid={dataTestid}
      >
        <ExclamationCircleSolid className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>{error}</span>
      </div>
    )
  }

  return (
    <div className="pt-2 text-rose-500 text-small-regular" data-testid={dataTestid}>
      <span>{error}</span>
    </div>
  )
}

export default ErrorMessage
