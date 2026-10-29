import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { ANNOUNCEMENTS_MODULE } from "../../../modules/announcements";
import AnnouncementsModuleService from "../../../modules/announcements/service";
import { isVigente } from "../../../modules/announcements/utils/vigencia";

/*

Barra de anuncios del storefront. Igual que /store/banners, no acepta
filtros del cliente: devuelve solo anuncios activos y vigentes ahora,
del más antiguo al más nuevo (orden de rotación), más la configuración
de presentación (colores, intervalo, lugares).

Sin sesión de colaborador solo se responde si el admin habilitó el lugar
"login"; si no, la lista va vacía para no exponer avisos internos a
visitantes anónimos. El filtro por página (home, carrito, …) lo hace el
storefront con `lugares`.

*/
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const service =
    req.scope.resolve<AnnouncementsModuleService>(ANNOUNCEMENTS_MODULE);
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const settings = await service.getSettings();
  const { id: _id, ...presentacion } = settings;

  const isLoggedIn = !!req.auth_context?.actor_id;
  if (!isLoggedIn && !settings.lugares.includes("login")) {
    res.json({ settings: presentacion, announcements: [] });
    return;
  }

  const { data } = await query.graph({
    entity: "announcement",
    fields: [
      "id",
      "texto",
      "link",
      "icono",
      "posicion_icono",
      "fecha_inicio",
      "fecha_fin",
    ],
    filters: { activo: true },
    pagination: { order: { created_at: "ASC" } },
  });

  const now = new Date();
  const announcements = data
    .filter((announcement) => isVigente(announcement, now))
    .map(({ fecha_inicio: _i, fecha_fin: _f, ...announcement }) => announcement);

  res.json({ settings: presentacion, announcements });
};
