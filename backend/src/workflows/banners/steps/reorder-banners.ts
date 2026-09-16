import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { BANNERS_MODULE } from "../../../modules/banners";
import BannersModuleService from "../../../modules/banners/service";

export type ReorderBannersInput = {
  ids: string[];
};

type PreviousOrder = { id: string; orden: number };

// El panel nunca manda un "orden" a mano: manda el array de IDs en el
// orden visual que quedó tras el drag-and-drop, y acá se traduce a
// enteros 0..n-1 según esa posición.
export const reorderBannersStep = createStep(
  "reorder-banners",
  async (input: ReorderBannersInput, { container }) => {
    const bannersModuleService =
      container.resolve<BannersModuleService>(BANNERS_MODULE);

    const previousData = await bannersModuleService.listBanners({
      id: input.ids,
    });

    const previousOrder: PreviousOrder[] = previousData.map((banner) => ({
      id: banner.id,
      orden: banner.orden,
    }));

    const updated = await bannersModuleService.updateBanners(
      input.ids.map((id, index) => ({ id, orden: index }))
    );

    return new StepResponse(updated, previousOrder);
  },
  async (previousOrder: PreviousOrder[] | undefined, { container }) => {
    if (!previousOrder?.length) {
      return;
    }

    const bannersModuleService =
      container.resolve<BannersModuleService>(BANNERS_MODULE);

    await bannersModuleService.updateBanners(previousOrder);
  }
);
