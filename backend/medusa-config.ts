import { QUOTE_MODULE } from "./src/modules/quote";
import { APPROVAL_MODULE } from "./src/modules/approval";
import { BANNERS_MODULE } from "./src/modules/banners";
import { COMPANY_MODULE } from "./src/modules/company";
import { BENEFIT_BUDGET_MODULE } from "./src/modules/benefit-budget";
import { PICKUP_SCHEDULING_MODULE } from "./src/modules/pickup-scheduling";
import { loadEnv, defineConfig, Modules } from "@medusajs/framework/utils";
import { emailProviderId } from "./src/utils/email-delivery";

loadEnv(process.env.NODE_ENV!, process.cwd());

/**
 * Provider de correo del Notification Module según NOTIFICATION_PROVIDER
 * (ver el comentario de Modules.NOTIFICATION más abajo).
 */
const emailNotificationProvider = () => {
  const id = emailProviderId();

  if (id === "local") {
    return {
      resolve: "@medusajs/notification-local",
      id: "local",
      options: { name: "Local Notification Provider", channels: ["email"] },
    };
  }

  // "acs": reemplazar este error por la entrada del provider cuando exista:
  //   {
  //     resolve: "./src/modules/notification-acs",
  //     id: "acs",
  //     options: {
  //       channels: ["email"],
  //       connectionString: process.env.ACS_EMAIL_CONNECTION_STRING,
  //       sender: process.env.ACS_EMAIL_SENDER,
  //     },
  //   }
  throw new Error(
    `NOTIFICATION_PROVIDER="${id}" no está implementado todavía (por ahora solo "local").`
  );
};

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
      // Qué provider de auth puede usar cada actor (rut-auth, paso 3):
      // los colaboradores (customer) solo entran con RUT + clave; el Admin
      // (user) sigue con correo + clave. Con esto, POST
      // /auth/customer/emailpass responde error aunque exista la identidad.
      authMethodsPerActor: {
        customer: ["rut"],
        user: ["emailpass"],
      },
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
    [BENEFIT_BUDGET_MODULE]: {
      resolve: "./modules/benefit-budget",
    },
    [PICKUP_SCHEDULING_MODULE]: {
      resolve: "./modules/pickup-scheduling",
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
    // Auth Module con dos providers. Al declararlo acá se reemplaza la
    // configuración por defecto de Medusa, así que `emailpass` hay que
    // listarlo explícitamente o el Admin se queda sin login.
    // - emailpass: login del Admin (usuarios internos).
    // - rut:       login de colaboradores (src/modules/rut-auth).
    [Modules.AUTH]: {
      resolve: "@medusajs/medusa/auth",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/auth-emailpass",
            id: "emailpass",
          },
          {
            resolve: "./src/modules/rut-auth",
            id: "rut",
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

    // Correo transaccional (recuperación de contraseña y, más adelante, el
    // resto de las notificaciones). El provider se elige con
    // NOTIFICATION_PROVIDER (ver src/utils/email-delivery.ts):
    //
    // - "local" (por defecto): no manda correos; el Notification Module
    //   escribe el contenido en el log y, en desarrollo, el subscriber
    //   destaca el enlace en la consola. En producción el subscriber NO
    //   genera la notificación (el enlace lleva un token y no puede quedar
    //   en Log Analytics).
    // - "acs" (tarea 5.3 de infra): Azure Communication Services Email.
    //   Pasos: crear src/modules/notification-acs (provider), agregar su
    //   entrada abajo con sus opciones desde variables de entorno (Key
    //   Vault) y definir NOTIFICATION_PROVIDER=acs. El subscriber y la
    //   plantilla del correo no cambian.
    [Modules.NOTIFICATION]: {
      resolve: "@medusajs/notification",
      options: {
        providers: [emailNotificationProvider()],
      },
    },
  },
});
