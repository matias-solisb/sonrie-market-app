import { createSelectParams } from "@medusajs/medusa/api/utils/validators";
import { z } from "zod";

export type GetCartLineItemsBulkParamsType = z.infer<
  typeof GetCartLineItemsBulkParams
>;
export const GetCartLineItemsBulkParams = createSelectParams();

export type StoreAddLineItemsBulkType = z.infer<typeof StoreAddLineItemsBulk>;
export const StoreAddLineItemsBulk = z
  .object({
    line_items: z.array(
      z.object({
        variant_id: z.string(),
        quantity: z.number(),
      })
    ),
  })
  .strict();

export type StoreSetCartPickupSiteType = z.infer<typeof StoreSetCartPickupSite>;
export const StoreSetCartPickupSite = z
  .object({
    stock_location_id: z.string().min(1),
  })
  .strict();

export type StoreSetCartPickupDateType = z.infer<typeof StoreSetCartPickupDate>;
export const StoreSetCartPickupDate = z
  .object({
    fecha: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe tener formato YYYY-MM-DD."),
  })
  .strict();
