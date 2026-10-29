import { authenticate } from "@medusajs/framework";
import { MiddlewareRoute } from "@medusajs/medusa";

// Sesión opcional: el endpoint responde a visitantes sin sesión (pantalla
// de login), pero necesita saber si hay un colaborador logueado para
// decidir qué devolver (ver route.ts).
export const storeAnnouncementsMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/store/announcements",
    middlewares: [
      authenticate("customer", ["session", "bearer"], {
        allowUnauthenticated: true,
      }),
    ],
  },
];
