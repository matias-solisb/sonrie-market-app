import type {
  AuthenticatedMedusaRequest,
  MedusaRequest,
} from "@medusajs/framework";
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils";
import { z } from "zod";
import { PICKUP_SCHEDULING_MODULE } from "../../../modules/pickup-scheduling";
import PickupSchedulingModuleService from "../../../modules/pickup-scheduling/service";
import { getPickupSite, listPickupSites } from "../../../utils/pickup-sites";

/*

Utilidades de las rutas /admin/pickup-scheduling/*.

El módulo no conoce los Stock Locations (aislamiento de módulos de Medusa):
las rutas validan aquí que el site exista y esté configurado como site de
retiro (src/utils/pickup-sites.ts) antes de llamar al módulo.

*/

export const pickupService = (req: MedusaRequest) =>
  req.scope.resolve<PickupSchedulingModuleService>(PICKUP_SCHEDULING_MODULE);

/** Usuario del Admin que hace el cambio, para la auditoría. */
export const actorOf = (req: AuthenticatedMedusaRequest) =>
  req.auth_context?.actor_id ?? null;

/** El site de retiro, o 404. */
export const requireSite = async (req: MedusaRequest, stockLocationId: string) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const site = await getPickupSite(query, stockLocationId);

  if (!site) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `El site de retiro ${stockLocationId} no existe o no está configurado.`
    );
  }

  return site;
};

/** Nombres de los sites de retiro por id. */
export const siteNames = async (req: MedusaRequest) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const sites = await listPickupSites(query);

  return new Map(sites.map((s) => [s.id, s.name]));
};

/** Valida un query string con zod; 400 con el primer error. */
export const parseQuery = <T extends z.ZodTypeAny>(
  schema: T,
  query: unknown
): z.infer<T> => {
  const parsed = schema.safeParse(query);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      `${issue.path.join(".") || "query"}: ${issue.message}`
    );
  }

  return parsed.data;
};
