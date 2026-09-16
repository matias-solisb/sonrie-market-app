import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { BANNERS_MODULE } from "../../../modules/banners";
import BannersModuleService from "../../../modules/banners/service";

export type CreateBannerInput = {
  image_url: string;
  orden?: number;
  activo?: boolean;
};

export const createBannersStep = createStep(
  "create-banners",
  async (input: CreateBannerInput[], { container }) => {
    const bannersModuleService =
      container.resolve<BannersModuleService>(BANNERS_MODULE);

    const banners = await bannersModuleService.createBanners(input);

    return new StepResponse(
      banners,
      banners.map((banner) => banner.id)
    );
  },
  async (bannerIds: string[] | undefined, { container }) => {
    if (!bannerIds?.length) {
      return;
    }

    const bannersModuleService =
      container.resolve<BannersModuleService>(BANNERS_MODULE);

    await bannersModuleService.deleteBanners(bannerIds);
  }
);
