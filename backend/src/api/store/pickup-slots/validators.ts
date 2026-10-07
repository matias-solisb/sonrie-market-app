import { z } from "zod";

export type StoreGetPickupSlotsType = z.infer<typeof StoreGetPickupSlots>;
export const StoreGetPickupSlots = z.object({
  stock_location_id: z.string().min(1),
});
