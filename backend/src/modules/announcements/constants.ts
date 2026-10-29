/*

Constantes de la barra de anuncios. Son la fuente única para el backend
(validación y modelo) y el Admin. El storefront tiene una copia del
mismo listado en `storefront/src/lib/util/announcement-place.ts`: si se
agrega un ícono o un lugar acá, hay que agregarlo también allá.

- ANNOUNCEMENT_ICONS: set fijo de íconos de `@medusajs/icons`. Se guarda
  la clave (no el nombre del componente) para que renombrar un ícono de
  la librería no rompa los anuncios ya creados.
- ANNOUNCEMENT_PLACES: zonas del storefront donde puede verse la barra
  (ver storefront/src/lib/util/announcement-place.ts para el mapeo
  ruta → lugar). `login` es la única zona visible sin sesión.

*/
export const ANNOUNCEMENT_ICONS = [
  "camion",
  "calendario",
  "reloj",
  "info",
  "alerta",
  "regalo",
  "oferta",
  "tienda",
  "ubicacion",
  "campana",
  "destacado",
] as const;
export type AnnouncementIcon = (typeof ANNOUNCEMENT_ICONS)[number];

export const ANNOUNCEMENT_ICON_POSITIONS = ["izquierda", "derecha"] as const;
export type AnnouncementIconPosition =
  (typeof ANNOUNCEMENT_ICON_POSITIONS)[number];

export const ANNOUNCEMENT_PLACES = [
  "home",
  "catalogo",
  "producto",
  "carrito",
  "checkout",
  "cuenta",
  "login",
] as const;
export type AnnouncementPlace = (typeof ANNOUNCEMENT_PLACES)[number];

export const ANNOUNCEMENT_SETTING_KEY = "global";
export const DEFAULT_INTERVALO_SEGUNDOS = 5;
export const MIN_INTERVALO_SEGUNDOS = 3;
export const MAX_INTERVALO_SEGUNDOS = 60;
// Rojo de marca, el mismo de la barra de categorías (nav/index.tsx).
export const DEFAULT_COLOR_FONDO = "#E01441";
export const DEFAULT_COLOR_TEXTO = "#FFFFFF";
// Por defecto la barra sale en toda la tienda con sesión; `login` queda
// fuera a propósito: mostrar un aviso a visitantes anónimos es opt-in.
export const DEFAULT_LUGARES: AnnouncementPlace[] = [
  "home",
  "catalogo",
  "producto",
  "carrito",
  "checkout",
  "cuenta",
];
export const MAX_TEXTO_LENGTH = 500;
