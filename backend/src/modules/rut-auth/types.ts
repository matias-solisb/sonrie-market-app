/*

Estado que el provider `rut` guarda en `provider_metadata` de su provider
identity. Vive ahí (y no en un módulo propio) porque el provider solo ve el
contenedor del Auth Module: no puede leer customers ni otros módulos.

- password_hash:        hash argon2id (formato PHC, incluye los parámetros).
                        Nunca sale del provider: `sanitize` lo borra.
- failed_attempts:      intentos fallidos seguidos; vuelve a 0 con un login
                        correcto o un cambio de clave (lockout.ts).
- locked_until:         ISO 8601 (UTC) hasta cuando está bloqueada, o null.
- must_change_password: true desde el alta hasta que el colaborador cambia
                        la clave inicial (paso 6).
- password_changed_at:  ISO 8601 del último cambio; null = clave inicial.
- enabled:              habilitado para entrar a la tienda (paso 9). Un solo
                        indicador en el MVP; el doble estado activo_sap /
                        habilitado_admin se decide con employee-sync (F4).
- enabled_changed_at:   ISO 8601 del último cambio de `enabled` (o ausente).
- enabled_changed_by:   id del usuario del Admin que lo cambió (o ausente).

*/
export type RutProviderMetadata = {
  password_hash: string;
  failed_attempts: number;
  locked_until: string | null;
  must_change_password: boolean;
  password_changed_at: string | null;
  enabled: boolean;
  enabled_changed_at?: string | null;
  enabled_changed_by?: string | null;
};
