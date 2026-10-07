import { Module } from "@medusajs/framework/utils";
import PickupSchedulingModuleService from "./service";

export const PICKUP_SCHEDULING_MODULE = "pickup_scheduling";

export default Module(PICKUP_SCHEDULING_MODULE, {
  service: PickupSchedulingModuleService,
});
