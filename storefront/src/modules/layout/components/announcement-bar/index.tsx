"use client"

import {
  getAnnouncementPlace,
  StoreAnnouncement,
  StoreAnnouncementsResponse,
} from "@/lib/util/announcement-place"
import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { ANNOUNCEMENT_ICONS } from "./icons"

const FADE_MS = 250

/*

Barra de anuncios sobre el header (Admin → Barra de anuncios). Va antes de
NavigationHeader en los layouts: al hacer scroll se va con la página y el
header sigue sticky, así un aviso largo en móvil no le quita pantalla.

- Solo se muestra en los lugares que eligió el admin (configuración
  general) según la ruta actual (lib/util/announcement-place.ts).
- Con más de un anuncio, rota cada `intervalo_segundos`. La rotación se
  pausa con el mouse encima o con foco de teclado (WCAG 2.2.2) y no hay
  fundido si el usuario pidió reducir el movimiento.
- Si el anuncio tiene link, toda la franja es clickeable; los externos
  abren en otra pestaña.

*/
const AnnouncementBar = ({
  data,
  isLoggedIn,
}: {
  data: StoreAnnouncementsResponse | null
  isLoggedIn: boolean
}) => {
  const pathname = usePathname()
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)
  const [paused, setPaused] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  const announcements = data?.announcements ?? []
  const settings = data?.settings
  const count = announcements.length

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReducedMotion(query.matches)
    const onChange = (event: MediaQueryListEvent) =>
      setReducedMotion(event.matches)
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [])

  useEffect(() => {
    if (count < 2 || paused || !settings) {
      return
    }

    const next = () => setIndex((current) => (current + 1) % count)
    let fadeTimeout: ReturnType<typeof setTimeout> | undefined

    const interval = setInterval(() => {
      if (reducedMotion) {
        next()
        return
      }
      setVisible(false)
      fadeTimeout = setTimeout(() => {
        next()
        setVisible(true)
      }, FADE_MS)
    }, Math.max(settings.intervalo_segundos, 1) * 1000)

    return () => {
      clearInterval(interval)
      if (fadeTimeout) clearTimeout(fadeTimeout)
      setVisible(true)
    }
  }, [count, paused, reducedMotion, settings])

  if (!settings || count === 0) {
    return null
  }

  const place = getAnnouncementPlace(pathname, isLoggedIn)
  if (!place || !settings.lugares.includes(place)) {
    return null
  }

  const announcement = announcements[index % count]

  return (
    <div
      role="region"
      aria-label="Anuncios"
      data-testid="announcement-bar"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      style={{
        backgroundColor: settings.color_fondo,
        color: settings.color_texto,
        borderBottom: settings.color_borde
          ? `2px solid ${settings.color_borde}`
          : undefined,
      }}
    >
      <div
        className="content-container py-2 transition-opacity ease-in-out"
        style={{
          opacity: visible ? 1 : 0,
          transitionDuration: reducedMotion ? "0ms" : `${FADE_MS}ms`,
        }}
      >
        <AnnouncementContent announcement={announcement} />
      </div>
    </div>
  )
}

const AnnouncementContent = ({
  announcement,
}: {
  announcement: StoreAnnouncement
}) => {
  const Icon = announcement.icono
    ? ANNOUNCEMENT_ICONS[announcement.icono]
    : null
  const icon = Icon ? <Icon aria-hidden="true" className="shrink-0" /> : null

  const body = (
    <span className="flex items-center justify-center gap-x-3 text-center txt-compact-small-plus small:txt-compact-medium-plus">
      {announcement.posicion_icono === "izquierda" && icon}
      <span>{announcement.texto}</span>
      {announcement.posicion_icono === "derecha" && icon}
    </span>
  )

  if (!announcement.link) {
    return body
  }

  const className =
    "block hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded-sm"

  // Rutas internas ("/products") pasan por LocalizedClientLink para
  // conservar el código de país; las absolutas abren en otra pestaña.
  if (announcement.link.startsWith("/")) {
    return (
      <LocalizedClientLink href={announcement.link} className={className}>
        {body}
      </LocalizedClientLink>
    )
  }

  return (
    <a
      href={announcement.link}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {body}
    </a>
  )
}

export default AnnouncementBar
