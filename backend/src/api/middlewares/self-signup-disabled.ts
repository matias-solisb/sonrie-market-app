import { MiddlewareRoute } from "@medusajs/medusa";
import { deny } from "./deny";

/*

Autorregistro de clientes: DESACTIVADO.

Sonríe Market es una tienda interna. Las cuentas de colaborador las crea la
plataforma (workflow `create-colaborador`, vía src/utils/colaborador-alta.ts:
Admin → Clientes → "Alta de colaborador" o el script alta-colaborador;
después también bulk-import / employee-sync), nunca el propio usuario. El storefront ya no tiene pantalla de registro, pero las
rutas del core seguían abiertas: con la publishable key cualquiera podía
crearse una cuenta y comprar con el cupo de beneficio.

- `POST /auth/customer/:provider/register` → 403 para todo provider
  (emailpass y rut). El alta llama al Auth Module directamente,
  sin pasar por esta ruta.
- `POST /store/customers` → 403. Era el segundo paso del registro (crear el
  customer con el token de registro).

Siguen abiertos el login, `GET/POST /store/customers/me` y el reset de clave.

Admin:
- `POST /admin/customers` → 403. Es el "Create" del core (Clientes → Crear)
  y lo usaba el "Add" de Companies → Employees: crea un customer sin
  identidad `rut`, sin clave y sin employee, que no puede entrar a la tienda.
  El alta es `POST /admin/colaboradores`. Los matchers con método son
  exactos (express `app.post`), así que editar un cliente
  (`POST /admin/customers/:id`) y sus direcciones siguen funcionando.

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
  {
    method: ["POST"],
    matcher: "/admin/customers",
    middlewares: [
      deny(
        "Los clientes no se crean aquí. Usa \"Alta de colaborador\" en la lista de Clientes."
      ),
    ],
  },
];
