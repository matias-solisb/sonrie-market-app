import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils";
import { PICKUP_SCHEDULING_MODULE } from "../../../modules/pickup-scheduling";
import PickupSchedulingModuleService from "../../../modules/pickup-scheduling/service";
import { getPickupSite } from "../../../utils/pickup-sites";
import { StoreGetPickupSlots } from "./validators";

/*

GET /store/pickup-slots?stock_location_id=sloc_...

Fechas de retiro del site, desde hoy + lead-time hasta hoy + horizonte
(hora de Santiago). Incluye los días cerrados, para que el storefront los
muestre deshabilitados.

  {
    stock_location_id, desde, hasta,
    fechas: [{ fecha, disponible, cupos, motivo }]
  }

- `cupos`: cupos libres en este momento (0 si está cerrado o lleno).
- `motivo`: por qué está cerrado (feriado, inventario…), si se indicó.

No expone la capacidad total ni la ocupación: eso es del Admin. Es una foto:
el cupo se toma recién al confirmar el pedido.

*/
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const parsed = StoreGetPickupSlots.safeParse(req.query);

  if (!parsed.success) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Indica el site de retiro (stock_location_id)."
    );
  }

  const { stock_location_id } = parsed.data;
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const site = await getPickupSite(query, stock_location_id);

  if (!site) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "El site de retiro no existe."
    );
  }

  const service = req.scope.resolve<PickupSchedulingModuleService>(
    PICKUP_SCHEDULING_MODULE
  );

  const fechas = await service.listAvailableDates(site.id);

  res.json({
    stock_location_id: site.id,
    desde: fechas[0]?.fecha ?? null,
    hasta: fechas[fechas.length - 1]?.fecha ?? null,
    fechas: fechas.map((f) => ({
      fecha: f.fecha,
      disponible: f.disponibles > 0,
      cupos: f.disponibles,
      motivo: f.abierto ? null : f.motivo,
    })),
  });
};
