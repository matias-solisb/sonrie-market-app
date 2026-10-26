/*
Destino seguro para volver después del login (`redirect_to`). Vulnerabilidad
#5 (docs/vulnerabilidades.md): el filtro anterior rechazaba "//" y "://" pero
aceptaba "/\evil.com" y "/<tab>/evil.com", que el navegador resuelve a
https://evil.com/ (trata "\" como "/" y descarta tabs y saltos de línea).

Reglas:
- Solo rutas del propio sitio: tiene que empezar con "/".
- Se rechaza cualquier "\" y cualquier carácter de control (U+0000–U+001F,
  U+007F); un redirect legítimo nunca los trae sin codificar.
- Se resuelve con `new URL` contra un origen ficticio y se exige que el
  origen no cambie (atrapa "//evil.com" y variantes que el parser
  interprete como otro host).
- Se devuelve la ruta normalizada (pathname + search + hash), no el texto
  original.

Es una función pura (sin imports de Next) para poder testearla sola:
e2e/safe-redirect.unit.spec.ts.
*/

const BASE_ORIGIN = "http://sonrie-market.invalid"
const MAX_LENGTH = 2048

// eslint-disable-next-line no-control-regex
const FORBIDDEN_CHARS = /[\\\u0000-\u001F\u007F]/

export function getSafeRedirect(value: unknown): string | null {
  if (typeof value !== "string" || !value || value.length > MAX_LENGTH) {
    return null
  }
  if (!value.startsWith("/") || FORBIDDEN_CHARS.test(value)) {
    return null
  }

  let url: URL
  try {
    url = new URL(value, BASE_ORIGIN)
  } catch {
    return null
  }

  if (url.origin !== BASE_ORIGIN) {
    return null
  }

  return `${url.pathname}${url.search}${url.hash}`
}
