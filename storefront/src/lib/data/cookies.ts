"use server"

import "server-only"

import { cookies as nextCookies } from "next/headers"

export const getAuthHeaders = async (): Promise<
  { authorization: string } | {}
> => {
  try {
    const cookies = await nextCookies()
    const token = cookies.get("_medusa_jwt")?.value

    if (token) {
      return { authorization: `Bearer ${token}` }
    }

    return {}
  } catch (error) {
    return {}
  }
}

export const getCacheTag = async (tag: string): Promise<string> => {
  try {
    const cookies = await nextCookies()
    const cacheId = cookies.get("_medusa_cache_id")?.value

    if (!cacheId) {
      return ""
    }

    return `${tag}-${cacheId}`
  } catch (error) {
    return ""
  }
}

export const getCacheOptions = async (
  tag: string
): Promise<{ tags: string[] } | {}> => {
  if (typeof window !== "undefined") {
    return {}
  }

  const cacheTag = await getCacheTag(tag)

  if (!cacheTag) {
    return {}
  }

  return { tags: [`${cacheTag}`] }
}

export const setAuthToken = async (token: string) => {
  const cookies = await nextCookies()

  cookies.set("_medusa_jwt", token, {
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  })

  // Cada login empieza con la franja de perfil incompleto visible (si falta
  // algún dato), aunque en la sesión anterior se hubiera cerrado con la ✕.
  cookies.delete(PROFILE_BANNER_COOKIE)
}

/*

Franja de perfil incompleto cerrada con la ✕ (ProfileIncompleteBanner).

Va en una cookie, no en sessionStorage, para que el layout sepa en el
servidor si mostrarla: así viene en el HTML inicial y no empuja el home hacia
abajo al aparecer después de hidratar. Cookie de sesión (sin maxAge): se
pierde al cerrar el navegador; setAuthToken la borra en cada login. Guarda el
id del customer, para que no aplique a otra cuenta en el mismo navegador.

*/
const PROFILE_BANNER_COOKIE = "_sonrie_profile_banner_dismissed"

export const isProfileBannerDismissed = async (customerId: string) => {
  const cookies = await nextCookies()

  return cookies.get(PROFILE_BANNER_COOKIE)?.value === customerId
}

export const setProfileBannerDismissed = async (customerId: string) => {
  const cookies = await nextCookies()

  cookies.set(PROFILE_BANNER_COOKIE, customerId, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  })
}

export const removeAuthToken = async () => {
  const cookies = await nextCookies()

  cookies.delete("_medusa_jwt")
}

export const getCartId = async () => {
  const cookies = await nextCookies()

  return cookies.get("_medusa_cart_id")?.value
}

export const setCartId = async (cartId: string) => {
  const cookies = await nextCookies()

  cookies.set("_medusa_cart_id", cartId, {
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  })
}

export const removeCartId = async () => {
  const cookies = await nextCookies()

  cookies.set("_medusa_cart_id", "", {
    maxAge: -1,
  })
}
