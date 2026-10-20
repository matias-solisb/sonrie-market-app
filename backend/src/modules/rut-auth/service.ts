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
import { initialPasswordFromRut, normalizeRut } from "../../utils/rut";
import {
  ARGON2_PARAMS,
  INVALID_CREDENTIALS_MESSAGE,
  PASSWORD_POLICY,
  RUT_AUTH_PROVIDER_ID,
} from "./config";
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
- authenticate: verifica RUT + clave. Toda falla responde el mismo mensaje.
                El lockout, el tiempo de respuesta uniforme y el corte por
                `enabled` llegan en los pasos 7 y 9.
- update:       cambia la clave (reset por correo o cambio de clave). Deja
                must_change_password en false.

Hash: argon2id con los parámetros explícitos de config.ts.

*/

type InjectedDependencies = {
  logger: Logger;
};

const ARGON2ID = 2; // Algorithm.Argon2id de @node-rs/argon2 (const enum)

export const hashPassword = (password: string) =>
  hash(password, { algorithm: ARGON2ID as any, ...ARGON2_PARAMS });

class RutAuthProviderService extends AbstractAuthModuleProvider {
  static identifier = RUT_AUTH_PROVIDER_ID;
  static DISPLAY_NAME = "RUT + clave";

  protected logger_: Logger;

  constructor({ logger }: InjectedDependencies) {
    // @ts-ignore — el constructor base recibe (container, options)
    super(...arguments);
    this.logger_ = logger;
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

    const { password } = data.body ?? {};
    const rut = normalizeRut(data.body?.rut);

    if (!rut || !isString(password) || !password) {
      return fail;
    }

    let authIdentity: AuthIdentityDTO;
    try {
      authIdentity = await authIdentityService.retrieve({ entity_id: rut });
    } catch (error) {
      if (error.type === MedusaError.Types.NOT_FOUND) {
        return fail;
      }
      return { success: false, error: error.message };
    }

    const metadata = this.metadataOf_(authIdentity);

    if (!isString(metadata?.password_hash)) {
      return fail;
    }

    let valid = false;
    try {
      valid = await verify(metadata.password_hash, password);
    } catch (error) {
      this.logger_.error(`rut-auth: no se pudo verificar el hash: ${error.message}`);
      return fail;
    }

    if (!valid) {
      return fail;
    }

    return { success: true, authIdentity: this.sanitize_(authIdentity) };
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

    if (!isString(password) || password.length < PASSWORD_POLICY.minLength) {
      return {
        success: false,
        error: `La clave debe tener al menos ${PASSWORD_POLICY.minLength} caracteres`,
      };
    }

    try {
      const current = await authIdentityService.retrieve({ entity_id: rut });
      const metadata: RutProviderMetadata = {
        ...this.metadataOf_(current),
        password_hash: await hashPassword(password),
        must_change_password: false,
        password_changed_at: new Date().toISOString(),
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
