/*
Validación de variables de entorno al arrancar (vulnerabilidades #4 y #9,
docs/vulnerabilidades.md). Se llama desde medusa-config.ts.

- En producción (NODE_ENV=production), los errores detienen el arranque:
  un JWT_SECRET/COOKIE_SECRET ausente, de ejemplo ("supersecret") o corto
  permitiría firmar tokens, incluidos los de admin.
- Fuera de producción (desarrollo, test) los mismos problemas son solo
  advertencias, para no romper el entorno local.
- `medusa build` no necesita secretos (y no deben quedar en la imagen):
  ahí todo se reporta como advertencia.

`medusa start` define NODE_ENV=production si no viene definido; el riesgo
es que el despliegue lo fije a otro valor. Eso se advierte (ver #9:
email-delivery.ts y auth-audit.ts relajan controles fuera de producción).
*/

export const MIN_SECRET_LENGTH = 32;

/** Valores de ejemplo conocidos (starter de Medusa, .env.template, README). */
const KNOWN_WEAK_SECRETS = new Set(["supersecret", "secret", "changeme"]);

const REQUIRED_VARS = ["DATABASE_URL", "STORE_CORS", "ADMIN_CORS", "AUTH_CORS"] as const;
const SIGNING_SECRETS = ["JWT_SECRET", "COOKIE_SECRET"] as const;

export type EnvCheck = { errors: string[]; warnings: string[] };

const blank = (v: string | undefined) => !v || !v.trim();

const secretProblem = (name: string, value: string | undefined): string | null => {
  if (blank(value)) {
    return `${name} no está definido.`;
  }
  if (KNOWN_WEAK_SECRETS.has(value!.trim().toLowerCase())) {
    return `${name} usa un valor de ejemplo ("${value}").`;
  }
  if (value!.length < MIN_SECRET_LENGTH) {
    return `${name} tiene menos de ${MIN_SECRET_LENGTH} caracteres.`;
  }
  return null;
};

/** Comando del CLI de Medusa en curso (develop, start, build, db:migrate...). */
export const cliCommand = (argv: string[] = process.argv): string | undefined =>
  argv.slice(2).find((a) => !a.startsWith("-"));

export const checkEnv = (
  env: NodeJS.ProcessEnv = process.env,
  command: string | undefined = cliCommand()
): EnvCheck => {
  const problems: string[] = [];
  const warnings: string[] = [];
  const isProduction = env.NODE_ENV === "production";

  for (const name of REQUIRED_VARS) {
    if (blank(env[name])) {
      problems.push(`${name} no está definido.`);
    }
  }

  for (const name of SIGNING_SECRETS) {
    const problem = secretProblem(name, env[name]);
    if (problem) {
      problems.push(problem);
    }
  }

  if (
    !blank(env.JWT_SECRET) &&
    env.JWT_SECRET === env.COOKIE_SECRET
  ) {
    warnings.push("JWT_SECRET y COOKIE_SECRET son iguales; conviene que sean distintos.");
  }

  // Fuera de producción auth-audit.ts usa un secreto de desarrollo; en
  // producción es obligatorio.
  if (isProduction) {
    const problem = secretProblem("AUDIT_HASH_SECRET", env.AUDIT_HASH_SECRET);
    if (problem) {
      problems.push(problem);
    }
  }

  if (blank(env.NODE_ENV)) {
    warnings.push(
      "NODE_ENV no está definido: se aplican los defaults de desarrollo (enlaces de reset en logs, secreto de auditoría de desarrollo)."
    );
  } else if (command === "start" && !isProduction) {
    warnings.push(
      `"medusa start" con NODE_ENV="${env.NODE_ENV}": en QA/PRD debe ser "production" (si no, el enlace de reset queda en logs y la auditoría usa un secreto de desarrollo).`
    );
  }

  // En producción (salvo build) los problemas son errores; si no, advertencias.
  if (isProduction && command !== "build") {
    return { errors: problems, warnings };
  }
  return { errors: [], warnings: [...problems, ...warnings] };
};

/**
 * Marca que `medusa develop` deja en el entorno. develop carga esta config y
 * después hace fork de `medusa start` con NODE_ENV=development (y hereda el
 * entorno): sin la marca, el hijo repetiría las advertencias y además
 * reportaría por error "medusa start con NODE_ENV=development".
 */
export const DEVELOP_FLAG = "SONRIE_ENV_CHECKED_BY_DEVELOP";

/**
 * Valida el entorno: lanza si hay errores (detiene el arranque) y escribe las
 * advertencias en consola. El logger de Medusa aún no existe al cargar
 * medusa-config.ts, por eso console.
 */
export const assertEnv = (
  env: NodeJS.ProcessEnv = process.env,
  command: string | undefined = cliCommand()
): void => {
  if (command === "develop") {
    env[DEVELOP_FLAG] = "true";
  } else if (command === "start" && env[DEVELOP_FLAG] === "true") {
    // Servidor hijo de `medusa develop`: ya se validó en el proceso padre.
    return;
  }

  const { errors, warnings } = checkEnv(env, command);

  for (const w of warnings) {
    console.warn(`[env] ${w}`);
  }

  if (errors.length) {
    throw new Error(
      "Configuración inválida para producción:\n" +
        errors.map((e) => `  - ${e}`).join("\n") +
        "\nGenerar secretos con `openssl rand -base64 48` y cargarlos desde Key Vault."
    );
  }
};
