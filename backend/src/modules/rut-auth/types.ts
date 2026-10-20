/*

Estado que el provider `rut` guarda en `provider_metadata` de su provider
identity. Vive ahí (y no en un módulo propio) porque el provider solo ve el
contenedor del Auth Module: no puede leer customers ni otros módulos.

- password_hash:        hash argon2id (formato PHC, incluye los parámetros).
                        Nunca sale del provider: `sanitize` lo borra.
- failed_attempts:      intentos fallidos seguidos (paso 7).
- locked_until:         ISO 8601 o null (paso 7).
- must_change_password: true desde el alta hasta que el colaborador cambia
                        la clave inicial (paso 6).
- password_changed_at:  ISO 8601 del último cambio; null = clave inicial.
- enabled:              espejo de "habilitado". Por ahora un solo indicador;
                        el doble estado activo_sap / habilitado_admin se
                        decide con employee-sync o el backoffice (Fase 1/4).

*/
export type RutProviderMetadata = {
  password_hash: string;
  failed_attempts: number;
  locked_until: string | null;
  must_change_password: boolean;
  password_changed_at: string | null;
  enabled: boolean;
};
