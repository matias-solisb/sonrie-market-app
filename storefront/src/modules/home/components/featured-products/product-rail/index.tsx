"use client"

import { ChevronLeftMini, ChevronRightMini } from "@medusajs/icons"
import { clx } from "@medusajs/ui"
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"

/*

Carrusel horizontal de productos ("rail") para la home.

- El desplazamiento es scroll nativo con `scroll-snap`: funciona con el dedo
  o el trackpad sin JS, y el navegador se encarga de la inercia.
- Las flechas solo aparecen si hay contenido oculto hacia ese lado, y
  avanzan ~una "pantalla" del rail por click.
- Es un Client Component solo por las flechas: los productos llegan ya
  renderizados en el servidor como `children` (cada uno debe ser un <li>),
  así que no se mueve la carga de datos al cliente.

Mismo estilo de flechas que el carrusel de banners (`home/components/hero`).

*/
const ProductRail = ({
  children,
  label,
}: {
  children: ReactNode
  /** Nombre accesible del carrusel (lo anuncia el lector de pantalla). */
  label: string
}) => {
  const listRef = useRef<HTMLUListElement>(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

  const updateArrows = useCallback(() => {
    const list = listRef.current
    if (!list) return
    // 1px de tolerancia por el redondeo de subpíxeles al hacer scroll.
    setCanPrev(list.scrollLeft > 1)
    setCanNext(list.scrollLeft + list.clientWidth < list.scrollWidth - 1)
  }, [])

  useEffect(() => {
    const list = listRef.current
    if (!list) return

    updateArrows()
    list.addEventListener("scroll", updateArrows, { passive: true })
    // Recalcula al cambiar el ancho (rotar el celular, redimensionar).
    const observer = new ResizeObserver(updateArrows)
    observer.observe(list)

    return () => {
      list.removeEventListener("scroll", updateArrows)
      observer.disconnect()
    }
  }, [updateArrows])

  const scrollByPage = (direction: -1 | 1) => {
    const list = listRef.current
    if (!list) return
    list.scrollBy({ left: direction * list.clientWidth * 0.9, behavior: "smooth" })
  }

  const arrowClass =
    "absolute top-1/3 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ui-fg-base shadow hover:bg-white small:flex"

  return (
    <div className="relative" role="region" aria-roledescription="carrusel" aria-label={label}>
      <ul
        ref={listRef}
        className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2"
        data-testid="product-rail"
      >
        {children}
      </ul>

      {canPrev && (
        <button
          type="button"
          onClick={() => scrollByPage(-1)}
          aria-label="Ver productos anteriores"
          className={clx(arrowClass, "-left-3")}
          data-testid="product-rail-prev"
        >
          <ChevronLeftMini />
        </button>
      )}
      {canNext && (
        <button
          type="button"
          onClick={() => scrollByPage(1)}
          aria-label="Ver más productos"
          className={clx(arrowClass, "-right-3")}
          data-testid="product-rail-next"
        >
          <ChevronRightMini />
        </button>
      )}
    </div>
  )
}

export default ProductRail
