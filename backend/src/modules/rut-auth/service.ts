import { randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import {
  AuthenticationInput,
  AuthenticationResponse,
  AuthIdentityDTO,
  AuthIdentityProviderService,
  Logger,
} from "@medusajs/framework/types";
import {
  AbstractAuthModuleProvider,
  isString,
  MedusaError,
} from "@medusajs/framework/utils";
import { auditAuth, clientIp, colaboradorRef } from "../../utils/auth-audit";
import { initialPasswordFromRut, normalizeRut } from "../../utils/rut";
import {
  ACCOUNT_DISABLED_MESSAGE,
  ARGON2_PARAMS,
  INVALID_CREDENTIALS_MESSAGE,
  PASSWORD_POLICY,
  RUT_AUTH_PROVIDER_ID,
} from "./config";
import { registerAttempt, resetAttempts } from "./lockout";
import { checkNewPassword } from "./password-policy";
import { RutProviderMetadata } from "./types";

/*

Provider de autenticación `rut` (rut-auth, paso 3).

Login de colaboradores con RUT + clave. Convive con `emailpass`, que sigue
siendo el login del Admin; `authMethodsPerActor` en medusa-config.ts deja a
los customers solo con este provider.

- register:     crea la identidad con el RUT normalizado como entity_id y
                la clave inicial (últimos 4 dígitos del RUT) generada acá.
                Ignora cualquier clave que venga en el body: nadie elige su
                clave inicial. La ruta HTTP de registro está bloqueada
                (self-signup-disabled.ts); solo el alta la usa, vía el Auth
                Module.
- authenticate: verifica RUT + clave con lockout (lockout.ts): el intento
                se cuenta ANTES de verificar y una cuenta bloqueada se
                rechaza aunque la clave sea correcta. Toda falla (RUT
                inexistente o inválido, clave incorrecta, bloqueo) responde
                el mismo mensaje y hace UNA verificación argon2, contra un
                hash señuelo cuando no hay hash real: así todas tardan lo
                mismo y no revelan qué RUTs existen. Una cuenta deshabilitada
                (paso 9) solo se informa como tal si la clave es CORRECTA:
                sin la clave, no se distingue de un RUT inexistente.
- update:       cambia la clave (reset por correo o cambio de clave) si
                cumple la política (password-policy.ts). Deja
                must_change_password en false y reinicia el lockout (el
                reset por correo del paso 8 desbloquea la cuenta). No verifica la clave actual:
                eso lo hace quien llama (POST /store/customers/me/password).

Auditoría (paso 10): authenticate registra auth.login_ok, auth.login_fallido
(con motivo) y auth.bloqueo; ver utils/auth-audit.ts. El cambio de clave lo
registran quienes llaman a update (ruta de cambio de clave y middleware del
reset), porque solo ellos saben el origen.

Hash: argon2id con los parámetros explícitos de config.ts.

*/

type Knex = {
  raw: (sql: string, bindings?: unknown[]) => Promise<{ rows: any[] }>;
};

type InjectedDependencies = {
  logger: Logger;
  __pg_connection__: Knex;
};

const ARGON2ID = 2; // Algorithm.Argon2id de @node-rs/argon2 (const enum)

export const hashPassword = (password: string) =>
  hash(password, { algorithm: ARGON2ID as any, ...ARGON2_PARAMS });

/*
Hash señuelo: misma configuración que los reales, de una clave aleatoria que
nadie conoce. Se calcula una vez por proceso (la primera vez que hace falta).
*/
let decoyHash: Promise<string> | null = null;

const verifyAgainstDecoy = async (password: unknown) => {
  decoyHash ??= hashPassword(randomBytes(32).toString("hex"));
  const candidate = (isString(password) ? password : "").slice(
    0,
    PASSWORD_POLICY.maxLength
  );
  try {
    await verify(await decoyHash, candidate || "-");
  } catch {
    // Nunca coincide; solo importa el tiempo que toma.
  }
  return false;
};

class RutAuthProviderService extends AbstractAuthModuleProvider {
  static identifier = RUT_AUTH_PROVIDER_ID;
  static DISPLAY_NAME = "RUT + clave";

  protected logger_: Logger;
  protected pg_: Knex;

  constructor({ logger, __pg_connection__ }: InjectedDependencies) {
    // @ts-ignore — el constructor base recibe (container, options)
    super(...arguments);
    this.logger_ = logger;
    this.pg_ = __pg_connection__;
  }

  async register(
    data: AuthenticationInput,
    authIdentityService: AuthIdentityProviderService
  ): Promise<AuthenticationResponse> {
    const rut = normalizeRut(data.body?.rut);

    if (!rut) {
      return { success: false, error: "RUT inválido" };
    }

    try {
      await authIdentityService.retrieve({ entity_id: rut });
      return {
        success: false,
        error: "Ya existe una identidad para ese RUT",
      };
    } catch (error) {
      if (error.type !== MedusaError.Types.NOT_FOUND) {
        return { success: false, error: error.message };
      }
    }

    const metadata: RutProviderMetadata = {
      password_hash: await hashPassword(initialPasswordFromRut(rut)),
      failed_attempts: 0,
      locked_until: null,
      must_change_password: true,
      password_changed_at: null,
      enabled: true,
    };

    try {
      const authIdentity = await authIdentityService.create({
        entity_id: rut,
        provider_metadata: metadata,
      });
      return { success: true, authIdentity: this.sanitize_(authIdentity) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async authenticate(
    data: AuthenticationInput,
    authIdentityService: AuthIdentityProviderService
  ): Promise<AuthenticationResponse> {
    const fail: AuthenticationResponse = {
      success: false,
      error: INVALID_CREDENTIALS_MESSAGE,
    };

    // Auditoría (paso 10). La ruta HTTP de login del core siempre manda
    // `url`; POST /store/customers/me/password llama sin `url` para verificar
    // la clave actual: esos intentos cuentan igual para el bloqueo, pero se
    // registran con canal "cambio_clave" y sin login_ok.
    const canal = data.url ? "login" : "cambio_clave";
    const origin = { canal, ...clientIp(data.headers as any) };
    const failed = (motivo: string, fields: Record<string, unknown>) =>
      auditAuth(this.logger_, "auth.login_fallido", { motivo, ...fields, ...origin });

    const { password } = data.body ?? {};
    const rut = normalizeRut(data.body?.rut);

    if (
      !rut ||
      !isString(password) ||
      !password ||
      password.length > PASSWORD_POLICY.maxLength
    ) {
      await verifyAgainstDecoy(password);
      // Con un RUT válido pero sin clave usable, igual se sabe a qué RUT
      // apuntaba; con un RUT inválido no hay nada que identificar.
      failed(rut ? "clave_invalida" : "rut_invalido", {
        ...(rut ? colaboradorRef(null, rut, this.logger_) : { customer_id: null }),
      });
      return fail;
    }

    let attempt: Awaited<ReturnType<typeof registerAttempt>>;
    try {
      attempt = await registerAttempt(this.pg_, rut);
    } catch (error) {
      this.logger_.error(`rut-auth: no se pudo registrar el intento: ${error.message}`);
      failed("error_interno", colaboradorRef(null, rut, this.logger_));
      return { success: false, error: "No se pudo iniciar sesión" };
    }

    // RUT inexistente o cuenta bloqueada: mismo trabajo y misma respuesta que
    // una clave incorrecta.
    if (!attempt.exists || attempt.locked || !isString(attempt.metadata?.password_hash)) {
      await verifyAgainstDecoy(password);

      if (!attempt.exists) {
        failed("rut_inexistente", colaboradorRef(null, rut, this.logger_));
      } else {
        failed(attempt.locked ? "cuenta_bloqueada" : "sin_clave", {
          ...colaboradorRef(attempt.customerId, rut, this.logger_),
          bloqueada_hasta: attempt.metadata?.locked_until ?? null,
        });
      }
      return fail;
    }

    const who = colaboradorRef(attempt.customerId, rut, this.logger_);

    let valid = false;
    try {
      valid = await verify(attempt.metadata.password_hash, password);
    } catch (error) {
      this.logger_.error(`rut-auth: no se pudo verificar el hash: ${error.message}`);
      failed("error_interno", who);
      return fail;
    }

    if (!valid) {
      failed("clave_incorrecta", {
        ...who,
        intentos_fallidos: attempt.metadata.failed_attempts ?? null,
      });

      if (attempt.lockedNow) {
        auditAuth(this.logger_, "auth.bloqueo", {
          ...who,
          intentos_fallidos: attempt.metadata.failed_attempts ?? null,
          bloqueada_hasta: attempt.metadata.locked_until ?? null,
          ...origin,
        });
      }
      return fail;
    }

    // La clave es correcta: el intento no cuenta como fallido.
    await resetAttempts(this.pg_, rut);

    if (attempt.metadata.enabled === false) {
      failed("cuenta_deshabilitada", who);
      return { success: false, error: ACCOUNT_DISABLED_MESSAGE };
    }

    try {
      const authIdentity = await authIdentityService.retrieve({ entity_id: rut });

      if (canal === "login") {
        auditAuth(this.logger_, "auth.login_ok", { ...who, ...origin });
      }

      return { success: true, authIdentity: this.sanitize_(authIdentity) };
    } catch (error) {
      failed("error_interno", who);
      return { success: false, error: error.message };
    }
  }

  async update(
    data: Record<string, unknown>,
    authIdentityService: AuthIdentityProviderService
  ): Promise<AuthenticationResponse> {
    const rut = normalizeRut(data?.entity_id);
    const { password } = data ?? {};

    if (!rut) {
      return {
        success: false,
        error: `No se puede actualizar la identidad ${RUT_AUTH_PROVIDER_ID} sin un RUT válido`,
      };
    }

    const policyError = checkNewPassword(rut, password);

    if (policyError) {
      return { success: false, error: policyError };
    }

    try {
      const current = await authIdentityService.retrieve({ entity_id: rut });
      const metadata: RutProviderMetadata = {
        ...this.metadataOf_(current),
        password_hash: await hashPassword(password as string),
        must_change_password: false,
        password_changed_at: new Date().toISOString(),
        failed_attempts: 0,
        locked_until: null,
      };

      const authIdentity = await authIdentityService.update(rut, {
        provider_metadata: metadata,
      });

      return { success: true, authIdentity: this.sanitize_(authIdentity) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  private metadataOf_(authIdentity: AuthIdentityDTO): RutProviderMetadata {
    const providerIdentity = authIdentity.provider_identities?.find(
      (pi) => pi.provider === this.provider
    );
    return (providerIdentity?.provider_metadata ?? {}) as RutProviderMetadata;
  }

  /** Copia de la identidad sin el hash, para devolverla fuera del provider. */
  private sanitize_(authIdentity: AuthIdentityDTO): AuthIdentityDTO {
    const copy = JSON.parse(JSON.stringify(authIdentity)) as AuthIdentityDTO;
    const providerIdentity = copy.provider_identities?.find(
      (pi) => pi.provider === this.provider
    );
    if (providerIdentity?.provider_metadata) {
      delete providerIdentity.provider_metadata.password_hash;
    }
    return copy;
  }
}

export default RutAuthProviderService;
