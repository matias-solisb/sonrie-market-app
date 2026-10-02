import { HttpTypes } from "@medusajs/types"
import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL
const PUBLISHABLE_API_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
const DEFAULT_REGION = process.env.NEXT_PUBLIC_DEFAULT_REGION || "us"

// Cookie que setea el login (ver src/lib/data/cookies.ts -> setAuthToken).
const AUTH_COOKIE_NAME = "_medusa_jwt"

// Mismo secreto con que el backend firma los JWT (projectConfig.http.jwtSecret
// en backend/medusa-config.ts). Variable SOLO de servidor: nunca NEXT_PUBLIC_.
const JWT_SECRET = process.env.JWT_SECRET

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

// La clave HMAC se importa una sola vez y se reutiliza en cada request:
// importarla por request agregaba latencia a todas las rutas protegidas.
let hmacKeyPromise: Promise<CryptoKey> | null = null
function getHmacKey(secret: string): Promise<CryptoKey> {
  hmacKeyPromise ??= crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  )
  return hmacKeyPromise
}

function base64UrlToBytes(input: string): Uint8Array {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/")
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/*

Antes bastaba con que la cookie EXISTIERA para dejar pasar a las rutas
protegidas, así que cualquier valor inventado abría el catálogo (hallazgo
del testing E2E, session.spec.ts). Ahora se valida el JWT como lo hace el
backend: firma HS256 con JWT_SECRET, vencimiento (exp) y que sea un token de
customer con actor_id. Se usa Web Crypto (crypto.subtle) porque el middleware
corre en el runtime Edge y no necesita dependencias extra.

Ojo: esto NO revoca tokens al cerrar sesión. Un token válido robado sigue
sirviendo hasta que vence (JWT sin estado de Medusa) — ver hallazgo aparte.

*/
async function hasValidSession(token: string | undefined): Promise<boolean> {
  if (!token) return false

  if (!JWT_SECRET) {
    console.error(
      "[middleware] Falta JWT_SECRET en el entorno del storefront: no se puede validar la sesión y se trata como no logueado."
    )
    return false
  }

  const parts = token.split(".")
  if (parts.length !== 3) return false
  const [encodedHeader, encodedPayload, encodedSignature] = parts

  try {
    const header = JSON.parse(textDecoder.decode(base64UrlToBytes(encodedHeader)))
    if (header.alg !== "HS256") return false

    const key = await getHmacKey(JWT_SECRET)
    const signatureOk = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(encodedSignature),
      textEncoder.encode(`${encodedHeader}.${encodedPayload}`)
    )
    if (!signatureOk) return false

    const payload = JSON.parse(textDecoder.decode(base64UrlToBytes(encodedPayload)))
    if (typeof payload.exp === "number" && payload.exp * 1000 <= Date.now()) {
      return false
    }
    if (payload.actor_type && payload.actor_type !== "customer") return false
    if (!payload.actor_id) return false

    return true
  } catch {
    // Token mal formado (base64 o JSON inválido)
    return false
  }
}

// Sonríe Market es un canal B2B cerrado: sin sesión no se navega el home,
// el catálogo (listado, categorías, colecciones, fichas de producto) ni el
// carrito. El match es sobre el path SIN el prefijo de countryCode.
const PROTECTED_PATH_REGEX =
  /^\/?$|^\/(products|categories|collections|store|cart)(\/.*)?$/

const regionMapCache = {
  regionMap: new Map<string, HttpTypes.StoreRegion>(),
  regionMapUpdated: Date.now(),
}

async function getRegionMap(cacheId: string) {
  const { regionMap, regionMapUpdated } = regionMapCache

  if (
    !regionMap.keys().next().value ||
    regionMapUpdated < Date.now() - 3600 * 1000
  ) {
    // Fetch regions from Medusa. We can't use the JS client here because middleware is running on Edge and the client needs a Node environment.
    const { regions } = await fetch(`${BACKEND_URL}/store/regions`, {
      headers: {
        "x-publishable-api-key": PUBLISHABLE_API_KEY!,
      },
      next: {
        revalidate: 3600,
        tags: [`regions-${cacheId}`],
      },
    }).then(async (response) => {
      const json = await response.json()

      if (!response.ok) {
        throw new Error(json.message)
      }

      return json
    })

    if (!regions?.length) {
      throw new Error(
        "No regions found. Please set up regions in your Medusa Admin."
      )
    }

    // Create a map of country codes to regions.
    regions.forEach((region: HttpTypes.StoreRegion) => {
      region.countries?.forEach((c) => {
        regionMapCache.regionMap.set(c.iso_2 ?? "", region)
      })
    })

    regionMapCache.regionMapUpdated = Date.now()
  }

  return regionMapCache.regionMap
}

/**
 * Fetches regions from Medusa and sets the region cookie.
 * @param request
 * @param response
 */
async function getCountryCode(
  request: NextRequest,
  regionMap: Map<string, HttpTypes.StoreRegion | number>
) {
  try {
    let countryCode

    const vercelCountryCode = request.headers
      .get("x-vercel-ip-country")
      ?.toLowerCase()

    const urlCountryCode = request.nextUrl.pathname.split("/")[1]?.toLowerCase()

    if (urlCountryCode && regionMap.has(urlCountryCode)) {
      countryCode = urlCountryCode
    } else if (vercelCountryCode && regionMap.has(vercelCountryCode)) {
      countryCode = vercelCountryCode
    } else if (regionMap.has(DEFAULT_REGION)) {
      countryCode = DEFAULT_REGION
    } else if (regionMap.keys().next().value) {
      countryCode = regionMap.keys().next().value
    }

    return countryCode
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "Middleware.ts: Error getting the country code. Did you set up regions in your Medusa Admin and define a NEXT_PUBLIC_MEDUSA_BACKEND_URL environment variable?"
      )
    }
  }
}

async function setCacheId(request: NextRequest, response: NextResponse) {
  const cacheId = request.nextUrl.searchParams.get("_medusa_cache_id")

  if (cacheId) {
    return cacheId
  }

  const newCacheId = crypto.randomUUID()
  response.cookies.set("_medusa_cache_id", newCacheId, { maxAge: 60 * 60 * 24 })
  return newCacheId
}

/**
 * Middleware to handle region selection and cache id.
 */
export async function middleware(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const cartId = searchParams.get("cart_id")
  const checkoutStep = searchParams.get("step")
  const cacheIdCookie = request.cookies.get("_medusa_cache_id")
  const cartIdCookie = request.cookies.get("_medusa_cart_id")

  let redirectUrl = request.nextUrl.href

  let response = NextResponse.redirect(redirectUrl, 307)

  // Set a cache id to invalidate the cache for this instance only
  const cacheId = await setCacheId(request, response)

  const regionMap = await getRegionMap(cacheId)

  const countryCode = regionMap && (await getCountryCode(request, regionMap))

  const urlHasCountryCode =
    countryCode && request.nextUrl.pathname.split("/")[1].includes(countryCode)

  // check if one of the country codes is in the url
  if (urlHasCountryCode) {
    const pathnameWithoutCountry =
      "/" + request.nextUrl.pathname.split("/").slice(2).join("/")

    const isProtectedPath = PROTECTED_PATH_REGEX.test(pathnameWithoutCountry)
    const authToken = request.cookies.get(AUTH_COOKIE_NAME)?.value
    const isAuthenticated = isProtectedPath
      ? await hasValidSession(authToken)
      : Boolean(authToken)

    // Sin sesión y pidiendo una ruta protegida: se corta acá, antes del
    // atajo de más abajo (que si no, dejaría pasar cualquier request que ya
    // tuviera las cookies de región/cache seteadas, sin chequear sesión).
    if (isProtectedPath && !isAuthenticated) {
      const countryFromUrl = request.nextUrl.pathname.split("/")[1]
      const loginUrl = new URL(
        `/${countryFromUrl}/account`,
        request.nextUrl.origin
      )
      loginUrl.searchParams.set(
        "redirect_to",
        `${request.nextUrl.pathname}${request.nextUrl.search}`
      )

      const loginRedirect = NextResponse.redirect(loginUrl, 307)

      // Cookie presente pero inválida (adulterada, vencida o de otro
      // secreto): se borra para que el navegador no la siga enviando.
      if (authToken) {
        loginRedirect.cookies.delete(AUTH_COOKIE_NAME)
      }

      return loginRedirect
    }

    if ((!cartId || cartIdCookie) && cacheIdCookie) {
      return NextResponse.next()
    }
  }

  // check if the url is a static asset
  if (request.nextUrl.pathname.includes(".")) {
    return NextResponse.next()
  }

  const redirectPath =
    request.nextUrl.pathname === "/" ? "" : request.nextUrl.pathname

  const queryString = request.nextUrl.search ? request.nextUrl.search : ""

  // If no country code is set, we redirect to the relevant region.
  if (!urlHasCountryCode && countryCode) {
    redirectUrl = `${request.nextUrl.origin}/${countryCode}${redirectPath}${queryString}`
    response = NextResponse.redirect(`${redirectUrl}`, 307)
  }

  // If a cart_id is in the params, we set it as a cookie and redirect to the address step.
  if (cartId && !checkoutStep) {
    redirectUrl = `${redirectUrl}&step=address`
    response = NextResponse.redirect(`${redirectUrl}`, 307)
    response.cookies.set("_medusa_cart_id", cartId, { maxAge: 60 * 60 * 24 })
  }

  return response
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|images|assets|png|svg|jpg|jpeg|gif|webp).*)",
  ],
}
