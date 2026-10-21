import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { rutRef } from "../utils/auth-audit";
import { maskRut, normalizeRut } from "../utils/rut";

/*

rut_ref de un RUT, para buscar sus eventos de auditoría en Log Analytics
(rut-auth, paso 10; ver utils/auth-audit.ts).

  npx medusa exec ./src/scripts/rut-ref.ts 12.345.678-5

Hay que correrlo con el MISMO AUDIT_HASH_SECRET del ambiente cuyos logs se
revisan. Solo hace falta para RUTs sin cuenta (los demás eventos llevan
customer_id) o para unir una solicitud de recuperación con su resultado.

Consulta de ejemplo (KQL):

  ContainerAppConsoleLogs_CL
  | extend e = parse_json(Log_s)
  | where tostring(e.evento) startswith "auth."
  | where tostring(e.rut_ref) == "<rut_ref>"

*/
export default async function rutRefScript({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const rut = normalizeRut(args[0]);

  if (!rut) {
    logger.error("Uso: npx medusa exec ./src/scripts/rut-ref.ts <RUT>  (RUT inválido)");
    return;
  }

  const ref = rutRef(rut, logger);

  if (!ref) {
    logger.error("Sin AUDIT_HASH_SECRET válido: no se puede calcular el rut_ref.");
    return;
  }

  // Se imprime el RUT enmascarado: este comando también deja rastro en logs.
  logger.info(`rut_ref de ${maskRut(rut)}: ${ref}`);
}
