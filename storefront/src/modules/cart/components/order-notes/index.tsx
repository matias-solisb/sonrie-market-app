"use client"

import { updateCart } from "@/lib/data/cart"
import { B2BCart } from "@/types/global"
import { ChatBubble } from "@medusajs/icons"
import { useState } from "react"

// Reutiliza el mismo campo que ya usa el paso de contacto en el checkout
// (cart.metadata.notes, ver checkout/components/contact-details-form) en vez
// de inventar uno nuevo: Medusa no tiene un campo de "notas del pedido" de
// primera clase en el carrito, pero sí un `metadata` libre (JSONB) donde el
// checkout ya guarda esto — así que la nota que se escribe acá es la misma
// que se ve/edita más adelante en el checkout, sin tocar la base de datos.
// updateCart() hace merge shallow del objeto que le pasamos con lo que ya
// tenga el cart en el backend, pero como "metadata" completo se reemplaza
// (no hace merge profundo de sus keys), hay que esparcir el metadata actual
// para no perder invoice_recipient/cost_center/etc. que haya guardado el
// checkout.
const OrderNotes = ({ cart }: { cart: B2BCart }) => {
  const savedNotes = (cart.metadata?.notes as string) ?? ""
  const [notes, setNotes] = useState(savedNotes)
  const [isSaving, setIsSaving] = useState(false)

  const handleBlur = async () => {
    if (notes === savedNotes) {
      return
    }

    setIsSaving(true)
    try {
      await updateCart({
        metadata: {
          ...(cart.metadata ?? {}),
          notes,
        },
      })
    } catch (error) {
      console.error(
        "No se pudieron guardar las observaciones del pedido",
        error
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-start gap-x-2 text-sm text-neutral-950 mb-3">
        <ChatBubble className="mt-0.5 shrink-0 text-neutral-950" />
        <span>Agrega informaciones y observaciones a tu pedido</span>
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={handleBlur}
        placeholder="ingresar observaciones"
        rows={3}
        className="w-full resize-none rounded-md border border-gray-200 p-3 text-sm text-neutral-950 placeholder:text-neutral-400 outline-none focus:border-gray-300"
        data-testid="cart-notes-textarea"
      />
      {isSaving && (
        <span className="text-xs text-neutral-400">Guardando…</span>
      )}
    </div>
  )
}

export default OrderNotes
