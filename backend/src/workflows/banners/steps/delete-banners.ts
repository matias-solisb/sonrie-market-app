import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { BANNERS_MODULE } from "../../../modules/banners";
import BannersModuleService from "../../../modules/banners/service";

export const deleteBannersStep = createStep(
  "delete-banners",
  async (ids: string[], { container }) => {
    const bannersModuleService =
      container.resolve<BannersModuleService>(BANNERS_MODULE);

    await bannersModuleService.softDeleteBanners(ids);

    return new StepResponse(ids, ids);
  },
  async (bannerIds: string[] | undefined, { container }) => {
    if (!bannerIds?.length) {
      return;
    }

    const bannersModuleService =
      container.resolve<BannersModuleService>(BANNERS_MODULE);

    await bannersModuleService.restoreBanners(bannerIds);
  }
);
