import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { updateBannersWorkflow } from "../../../../workflows/banners/workflows/update-banners";
import { deleteBannersWorkflow } from "../../../../workflows/banners/workflows/delete-banners";
import { AdminUpdateBannerType } from "../validators";

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { id } = req.params;

  const {
    data: [banner],
  } = await query.graph(
    {
      entity: "banners",
      fields: req.queryConfig.fields,
      filters: { id },
    },
    { throwIfKeyNotFound: true }
  );

  res.json({ banner });
};

export const POST = async (
  req: AuthenticatedMedusaRequest<AdminUpdateBannerType>,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { id } = req.params;

  await updateBannersWorkflow.run({
    input: { ...req.validatedBody, id },
    container: req.scope,
  });

  const {
    data: [banner],
  } = await query.graph(
    {
      entity: "banners",
      fields: req.queryConfig.fields,
      filters: { id },
    },
    { throwIfKeyNotFound: true }
  );

  res.json({ banner });
};

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const { id } = req.params;

  await deleteBannersWorkflow.run({
    input: { id },
    container: req.scope,
  });

  res.status(200).json({
    id,
    object: "banner",
    deleted: true,
  });
};
