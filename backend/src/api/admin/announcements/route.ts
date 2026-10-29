import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { createAnnouncementsWorkflow } from "../../../workflows/announcements/workflows/create-announcements";
import { assertRangoVigencia } from "./helpers";
import {
  AdminCreateAnnouncementType,
  AdminListAnnouncementsParamsType,
} from "./validators";

export const GET = async (
  req: AuthenticatedMedusaRequest<unknown, AdminListAnnouncementsParamsType>,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { q, activo, limit, offset } =
    req.validatedQuery as AdminListAnnouncementsParamsType;

  const filters: Record<string, unknown> = {};
  if (q) {
    filters.nombre = { $ilike: `%${q}%` };
  }
  if (typeof activo === "boolean") {
    filters.activo = activo;
  }

  const { data: announcements, metadata } = await query.graph({
    entity: "announcement",
    fields: req.queryConfig.fields,
    filters,
    pagination: {
      skip: offset,
      take: limit,
      order: { created_at: "DESC" },
    },
  });

  res.json({
    announcements,
    count: metadata!.count,
    offset: metadata!.skip,
    limit: metadata!.take,
  });
};

export const POST = async (
  req: AuthenticatedMedusaRequest<AdminCreateAnnouncementType>,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  assertRangoVigencia(req.validatedBody);

  const { result: created } = await createAnnouncementsWorkflow.run({
    input: [{ ...req.validatedBody }],
    container: req.scope,
  });

  const {
    data: [announcement],
  } = await query.graph(
    {
      entity: "announcement",
      fields: req.queryConfig.fields,
      filters: { id: created[0].id },
    },
    { throwIfKeyNotFound: true }
  );

  res.json({ announcement });
};
