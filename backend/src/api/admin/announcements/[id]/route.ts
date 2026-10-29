import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { deleteAnnouncementsWorkflow } from "../../../../workflows/announcements/workflows/delete-announcements";
import { updateAnnouncementsWorkflow } from "../../../../workflows/announcements/workflows/update-announcements";
import { assertRangoVigencia } from "../helpers";
import { AdminUpdateAnnouncementType } from "../validators";

const retrieve = async (req: AuthenticatedMedusaRequest<any>, id: string) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const {
    data: [announcement],
  } = await query.graph(
    {
      entity: "announcement",
      fields: req.queryConfig.fields,
      filters: { id },
    },
    { throwIfKeyNotFound: true }
  );
  return announcement;
};

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  res.json({ announcement: await retrieve(req, req.params.id) });
};

export const POST = async (
  req: AuthenticatedMedusaRequest<AdminUpdateAnnouncementType>,
  res: MedusaResponse
) => {
  const { id } = req.params;
  const body = req.validatedBody;

  // Un update parcial puede tocar solo una de las dos fechas: el rango se
  // valida contra lo que quedaría guardado.
  if ("fecha_inicio" in body || "fecha_fin" in body) {
    const current = await retrieve(req, id);
    assertRangoVigencia({
      fecha_inicio:
        "fecha_inicio" in body ? body.fecha_inicio : current.fecha_inicio,
      fecha_fin: "fecha_fin" in body ? body.fecha_fin : current.fecha_fin,
    });
  }

  await updateAnnouncementsWorkflow.run({
    input: { ...body, id },
    container: req.scope,
  });

  res.json({ announcement: await retrieve(req, id) });
};

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params;

  await deleteAnnouncementsWorkflow.run({
    input: { id },
    container: req.scope,
  });

  res.status(200).json({ id, object: "announcement", deleted: true });
};
