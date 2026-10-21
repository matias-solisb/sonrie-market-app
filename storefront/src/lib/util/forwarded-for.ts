import "server-only"
import { headers } from "next/headers"

/*

Reenvío de la IP del colaborador al backend (rut-auth, paso 10).

El login, la recuperación y el cambio de clave son server actions: quien
llama al backend es el servidor de Next.js, no el navegador. Sin esto, la
auditoría del backend vería siempre la IP del storefront. Se reenvía el
`X-Forwarded-For` que llegó al storefront tal cual; el backend decide cuánto
confiar en él (AUDIT_TRUSTED_PROXY_HOPS, ver backend/src/utils/auth-audit.ts).

*/
export async function forwardedForHeaders(): Promise<Record<string, string>> {
  try {
    const incoming = await headers()
    const chain = incoming.get("x-forwarded-for") ?? incoming.get("x-real-ip")
    return chain ? { "x-forwarded-for": chain } : {}
  } catch {
    // Fuera de una request (build, tests): sin IP.
    return {}
  }
}
