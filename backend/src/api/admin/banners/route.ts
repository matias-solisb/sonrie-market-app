import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { createBannersWorkflow } from "../../../workflows/banners/workflows/create-banners";
import { AdminCreateBannerType } from "./validators";

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const { fields, pagination } = req.queryConfig;

  const { data: banners, metadata } = await query.graph({
    entity: "banners",
    fields,
    filters: req.filterableFields,
    pagination,
  });

  res.json({
    banners,
    count: metadata!.count,
    offset: metadata!.skip,
    limit: metadata!.take,
  });
};

export const POST = async (
  req: AuthenticatedMedusaRequest<AdminCreateBannerType>,
  res: MedusaResponse
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const { result: createdBanners } = await createBannersWorkflow.run({
    input: [{ ...req.validatedBody }],
    container: req.scope,
  });

  const { data: banners } = await query.graph(
    {
      entity: "banners",
      fields: req.queryConfig.fields,
      filters: { id: createdBanners.map((banner) => banner.id) },
    },
    { throwIfKeyNotFound: true }
  );

  res.json({ banners });
};
