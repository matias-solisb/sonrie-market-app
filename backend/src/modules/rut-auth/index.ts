import { ModuleProvider, Modules } from "@medusajs/framework/utils";
import RutAuthProviderService from "./service";

/*

Provider `rut` del Auth Module. Se registra en medusa-config.ts dentro de
`Modules.AUTH`, junto a `emailpass` (login del Admin).

*/
export default ModuleProvider(Modules.AUTH, {
  services: [RutAuthProviderService],
});
