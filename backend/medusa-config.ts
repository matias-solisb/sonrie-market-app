import { QUOTE_MODULE } from "./src/modules/quote";
import { APPROVAL_MODULE } from "./src/modules/approval";
import { BANNERS_MODULE } from "./src/modules/banners";
import { COMPANY_MODULE } from "./src/modules/company";
import { loadEnv, defineConfig, Modules } from "@medusajs/framework/utils";

loadEnv(process.env.NODE_ENV!, process.cwd());

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    },
  },
  modules: {
    [COMPANY_MODULE]: {
      resolve: "./modules/company",
    },
    [QUOTE_MODULE]: {
      resolve: "./modules/quote",
    },
    [APPROVAL_MODULE]: {
      resolve: "./modules/approval",
    },
    [BANNERS_MODULE]: {
      resolve: "./modules/banners",
    },
    // File Module — provider local por ahora (interino, mientras blob
    // storage no está configurado). Cuando esté listo, se cambia el
    // provider/las opciones acá y no hay que tocar el módulo de banners
    // ni el resto de la app: todos consumen la URL que devuelva el
    // File Module, sea cual sea el provider activo.
    //
    // upload_dir DEBE ser "static" (el default del provider, ya usado acá
    // para las imágenes semilla de productos). El watcher de `medusa
    // develop` vigila todo el proyecto para reiniciar el server, pero
    // tiene una lista fija de carpetas ignoradas (node_modules, dist,
    // .medusa, src/admin, static, private) que no se puede configurar
    // desde acá. Si se sube un archivo a una carpeta que no está en esa
    // lista (ej. "uploads"), cada subida dispara un reinicio completo a
    // mitad del flujo de creación del banner.
    [Modules.FILE]: {
      resolve: "@medusajs/file",
      options: {
        providers: [
          {
            resolve: "@medusajs/file-local",
            id: "local",
            options: {
              upload_dir: "static",
              backend_url: `${process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"}/static`,
            },
          },
        ],
      },
    },
    [Modules.CACHE]: {
      //resolve: "@medusajs/medusa/cache-inmemory",
      resolve: "@medusajs/medusa/cache-redis",
      options: { 
        redisUrl: process.env.REDIS_URL,
      },
    },
    [Modules.WORKFLOW_ENGINE]: {
      resolve: "@medusajs/medusa/workflow-engine-inmemory",
    },

    // Necesario para "Olvidé mi contraseña" del storefront: cuando se pide
    // un reset (POST /auth/customer/emailpass/reset-password), el core de
    // Medusa emite el evento `auth.password_reset` — sin este módulo
    // registrado, el subscriber que lo escucha
    // (src/subscribers/customer-password-reset.ts) no tiene a quién
    // resolverle `Modules.NOTIFICATION` y el envío fallaría.
    //
    // Provider "local": no manda correos de verdad, solo hace
    // `logger.info(...)` con el destinatario y los datos de la
    // notificación (acá, el link de reset) en la terminal del backend —
    // sirve para probar el flujo completo en desarrollo sin necesitar
    // credenciales de ningún servicio de correo todavía. Para producción
    // hay que reemplazar este provider por uno real (SendGrid, Resend,
    // SMTP, etc.) con sus credenciales en `.env` — ver el comentario del
    // subscriber para el resto de lo que falta.
    [Modules.NOTIFICATION]: {
      resolve: "@medusajs/notification",
      options: {
        providers: [
          {
            resolve: "@medusajs/notification-local",
            id: "local",
            options: {
              name: "Local Notification Provider",
              channels: ["email"],
            },
          },
        ],
      },
    },
  },
});
