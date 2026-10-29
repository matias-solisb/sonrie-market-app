/*

Barra de anuncios: tipos compartidos y mapeo ruta → lugar.

Copia de las constantes del backend
(backend/src/modules/announcements/constants.ts): si allá se agrega un
lugar o un ícono, hay que agregarlo también acá.

Lugares:
  home      /cl
  catalogo  /cl/products, /cl/store, /cl/categories/…, /cl/collections/…
  producto  /cl/products/:handle
  carrito   /cl/cart
  checkout  /cl/checkout, /cl/order/confirmed/:id
  cuenta    /cl/account/… con sesión
  login     /cl/account sin sesión, /cl/recover-password, /cl/reset-password

Las páginas informativas (contacto, FAQ, términos) no tienen lugar: la
barra no se muestra ahí.

*/
export type AnnouncementPlace =
  | "home"
  | "catalogo"
  | "producto"
  | "carrito"
  | "checkout"
  | "cuenta"
  | "login"

export type AnnouncementIcon =
  | "camion"
  | "calendario"
  | "reloj"
  | "info"
  | "alerta"
  | "regalo"
  | "oferta"
  | "tienda"
  | "ubicacion"
  | "campana"
  | "destacado"

export type StoreAnnouncement = {
  id: string
  texto: string
  link: string | null
  icono: AnnouncementIcon | null
  posicion_icono: "izquierda" | "derecha"
}

export type StoreAnnouncementSettings = {
  intervalo_segundos: number
  lugares: AnnouncementPlace[]
  color_fondo: string
  color_texto: string
  color_borde: string | null
}

export type StoreAnnouncementsResponse = {
  settings: StoreAnnouncementSettings
  announcements: StoreAnnouncement[]
}

export const getAnnouncementPlace = (
  pathname: string | null | undefined,
  isLoggedIn: boolean
): AnnouncementPlace | null => {
  if (!pathname) {
    return null
  }

  // Quita el código de país (/cl/…) y las barras sobrantes.
  const segments = pathname.split("?")[0].split("/").filter(Boolean)
  const [first, second] = segments.slice(1)

  switch (first) {
    case undefined:
      return "home"
    case "products":
      return second ? "producto" : "catalogo"
    case "store":
    case "categories":
    case "collections":
      return "catalogo"
    case "cart":
      return "carrito"
    case "checkout":
      return "checkout"
    case "order":
      return "checkout"
    case "account":
      return isLoggedIn ? "cuenta" : "login"
    case "recover-password":
    case "reset-password":
      return "login"
    default:
      return null
  }
}
