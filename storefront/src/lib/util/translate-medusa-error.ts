/*

Traduce al español los mensajes en inglés que Medusa (core-flows) o los
hooks del B2B Starter devuelven al colaborador. Los mensajes propios de
Sonríe Market (beneficio, site de retiro, stock por site) ya vienen en
español desde el backend y pasan tal cual.

Si un mensaje no está en la lista se devuelve sin cambios: es preferible
mostrar el mensaje real a uno genérico que esconda la causa.

*/

const GENERIC_ERROR = "Ocurrió un error inesperado. Intenta nuevamente."

const TRANSLATIONS: Array<[RegExp, string]> = [
  [
    /some variant does not have the required inventory/i,
    "No hay stock suficiente de este producto para la cantidad que pediste.",
  ],
  [
    /is not associated with any stock location for variant/i,
    "Este producto no está disponible para retiro en este momento.",
  ],
  [
    /does not have any inventory items associated/i,
    "Este producto no está disponible en este momento.",
  ],
  [
    /do not exist or belong to a product that is not published|variant does not have a product/i,
    "Este producto ya no está disponible en la tienda.",
  ],
  [
    /do not have a price|has no unit price/i,
    "Este producto no tiene precio por ahora. Intenta más tarde.",
  ],
  [
    /cart is pending approval/i,
    "Tu carrito está esperando aprobación y no se puede modificar por ahora.",
  ],
  [
    /cart .* is already completed/i,
    "Este carrito ya se convirtió en un pedido. Recarga la página para empezar uno nuevo.",
  ],
  [
    /cannot complete a cart with no items/i,
    "Tu carrito está vacío.",
  ],
  [
    /item quantity must be greater than 0/i,
    "La cantidad debe ser mayor a 0.",
  ],
  [
    /line item with id: .* was not found/i,
    "Ese producto ya no está en tu carrito. Recarga la página.",
  ],
  [
    /shipping options are invalid for cart|shipping profiles that are not satisfied|no shipping method selected/i,
    "No se pudo asignar el retiro en el site elegido. Elige el site nuevamente.",
  ],
  [
    /fetch failed|failed to fetch|econnrefused|networkerror/i,
    "No pudimos conectar con la tienda. Revisa tu conexión e intenta nuevamente.",
  ],
  [/an unknown error occurred/i, GENERIC_ERROR],
]

export function translateMedusaError(message?: string | null): string {
  const text = `${message ?? ""}`.trim()

  if (!text) {
    return GENERIC_ERROR
  }

  for (const [pattern, translation] of TRANSLATIONS) {
    if (pattern.test(text)) {
      return translation
    }
  }

  return text
}

/** Mensaje para mostrar al colaborador a partir de un error capturado. */
export function userErrorMessage(error: unknown, fallback = GENERIC_ERROR): string {
  const message = (error as { message?: string } | null)?.message

  return message ? translateMedusaError(message) : fallback
}
