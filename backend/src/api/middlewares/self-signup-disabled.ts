import { MiddlewareRoute } from "@medusajs/medusa";
import { deny } from "./deny";

/*

Autorregistro de clientes: DESACTIVADO.

Sonríe Market es una tienda interna. Las cuentas de colaborador las crea la
plataforma (workflow `create-colaborador`, hoy desde
src/scripts/alta-colaborador.ts; después bulk-import / employee-sync), nunca
el propio usuario. El storefront ya no tiene pantalla de registro, pero las
rutas del core seguían abiertas: con la publishable key cualquiera podía
crearse una cuenta y comprar con el cupo de beneficio.

- `POST /auth/customer/:provider/register` → 403 para todo provider
  (emailpass y rut). El alta llama al Auth Module directamente,
  sin pasar por esta ruta.
- `POST /store/customers` → 403. Era el segundo paso del registro (crear el
  customer con el token de registro).

Siguen abiertos el login, `GET/POST /store/customers/me` y el reset de clave.

*/
export const selfSignupDisabledMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/auth/customer/:provider/register",
    middlewares: [deny("El registro de cuentas no está disponible.")],
  },
  {
    method: ["POST"],
    matcher: "/store/customers",
    middlewares: [deny("El registro de cuentas no está disponible.")],
  },
];
