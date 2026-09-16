import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { BANNERS_MODULE } from "../../../modules/banners";
import BannersModuleService from "../../../modules/banners/service";

export type UpdateBannerInput = {
  id: string;
  image_url?: string;
  orden?: number;
  activo?: boolean;
};

export const updateBannersStep = createStep(
  "update-banners",
  async (input: UpdateBannerInput, { container }) => {
    const bannersModuleService =
      container.resolve<BannersModuleService>(BANNERS_MODULE);

    const [previousData] = await bannersModuleService.listBanners({
      id: input.id,
    });

    const updatedBanner = await bannersModuleService.updateBanners(input);

    return new StepResponse(updatedBanner, previousData);
  },
  async (previousData: any, { container }) => {
    if (!previousData) {
      return;
    }

    const bannersModuleService =
      container.resolve<BannersModuleService>(BANNERS_MODULE);

    await bannersModuleService.updateBanners({
      id: previousData.id,
      image_url: previousData.image_url,
      orden: previousData.orden,
      activo: previousData.activo,
    });
  }
);
