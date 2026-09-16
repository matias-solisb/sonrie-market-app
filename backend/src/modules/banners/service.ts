import { MedusaService } from "@medusajs/framework/utils";
import { Banner } from "./models";

class BannersModuleService extends MedusaService({
  Banner,
}) {}

export default BannersModuleService
