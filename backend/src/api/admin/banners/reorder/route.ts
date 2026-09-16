import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { reorderBannersWorkflow } from "../../../../workflows/banners/workflows/reorder-banners";
import { AdminReorderBannersType } from "../validators";

export const POST = async (
  req: AuthenticatedMedusaRequest<AdminReorderBannersType>,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  await reorderBannersWorkflow.run({
    input: { ids: req.validatedBody.ids },
    container: req.scope,
  });

  const { data: banners } = await query.graph({
    entity: "banners",
    fields: ["id", "image_url", "orden", "activo"],
    filters: { id: req.validatedBody.ids },
    pagination: { order: { orden: "ASC" } },
  });

  res.json({ banners });
};
