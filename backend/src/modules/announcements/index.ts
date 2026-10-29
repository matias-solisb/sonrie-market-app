import { Module } from "@medusajs/framework/utils";
import AnnouncementsModuleService from "./service";

export const ANNOUNCEMENTS_MODULE = "announcements";

export default Module(ANNOUNCEMENTS_MODULE, {
  service: AnnouncementsModuleService,
});
