import type { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

// Endpoint público para el carrusel del home. A propósito no acepta
// filtros ni orden desde el cliente: siempre devuelve solo los banners
// activos, ordenados por `orden` ascendente. Así un banner desactivado
// nunca queda expuesto por esta URL, sea cual sea el frontend que la
// consuma.
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const { data: banners } = await query.graph({
    entity: "banners",
    fields: ["id", "image_url", "orden"],
    filters: { activo: true },
    pagination: { order: { orden: "ASC" } },
  });

  res.json({ banners });
};
