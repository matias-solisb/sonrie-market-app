"use client"

import { CheckCircleSolid, XMark } from "@medusajs/icons"
import { toast as sonnerToast } from "sonner"

/*
Toast de éxito con el estilo exacto de la captura de referencia: fondo
verde sólido, ícono de check y texto en blanco, botón X para cerrar,
abajo a la izquierda.

El `toast.success()` de `@medusajs/ui` (el que se usa en el resto del
sitio, p. ej. en `handleSave` de esta misma card) SIEMPRE se renderiza
con su propio componente `<Toast>`: fondo neutro (`bg-ui-bg-component`)
+ un ícono chico de color — no expone ninguna prop para pisar ese
estilo por un banner sólido. Por eso, para este caso puntual, se llama
directo a `toast.custom()` de `sonner` — la librería que `@medusajs/ui`
usa por debajo (confirmado leyendo su `<Toaster>`, que es un wrapper
directo de `<Toaster>` de `sonner`).

Esto NO requiere instalar ninguna librería nueva: `sonner` ya es una
dependencia (transitiva de `@medusajs/ui`, ya presente en
`node_modules`) y el `<Toaster>` global ya está montado en
`app/layout.tsx` con `position="bottom-left"`, que es exactamente donde
pide la captura — un toast pushado con `sonner` directo se renderiza en
ese mismo `<Toaster>` montado, no hace falta montar uno nuevo.
*/
export function showSuccessToast(message: string) {
  sonnerToast.custom(
    (id) => (
      <div className="flex items-center gap-x-3 rounded-lg bg-green-600 px-4 py-3.5 shadow-lg min-w-[320px] max-w-[440px]">
        <CheckCircleSolid className="shrink-0 text-white" />
        <span className="flex-1 text-sm font-medium text-white">
          {message}
        </span>
        <button
          type="button"
          onClick={() => sonnerToast.dismiss(id)}
          className="shrink-0 text-white/90 hover:text-white"
          aria-label="Cerrar"
        >
          <XMark />
        </button>
      </div>
    ),
    { duration: 4000 }
  )
}
