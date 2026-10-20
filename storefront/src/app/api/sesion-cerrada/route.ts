import { NextRequest, NextResponse } from "next/server"

/*

Cierra la sesión de un colaborador deshabilitado (rut-auth, paso 9).

Los layouts detectan la cuenta deshabilitada (lib/data/customer.ts →
enforceAccountState), pero un Server Component no puede borrar cookies: por
eso redirigen acá. Este route handler borra la cookie de sesión y manda al
login con ?sesion=cerrada, que muestra el aviso.

El backend ya rechaza todo lo que haga esa sesión (401 account_disabled);
esto solo deja al navegador en un estado limpio.

Es un GET a propósito (lo usa una redirección). Lo peor que puede hacer un
enlace malicioso a esta ruta es cerrar la sesión de quien lo abra.

*/
export async function GET(request: NextRequest) {
  const country = request.nextUrl.searchParams.get("country")
  const countryCode = country && /^[a-z]{2}$/.test(country) ? country : "cl"

  const loginUrl = new URL(`/${countryCode}/account`, request.nextUrl.origin)
  loginUrl.searchParams.set("sesion", "cerrada")

  const response = NextResponse.redirect(loginUrl, 307)
  response.cookies.delete("_medusa_jwt")
  response.cookies.delete("_medusa_cart_id")

  return response
}
