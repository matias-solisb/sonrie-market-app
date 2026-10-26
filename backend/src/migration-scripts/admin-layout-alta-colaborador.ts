import { ExecArgs, ISettingsModuleService } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import {
  ALTA_COLABORADOR_WIDGET_ID,
  CUSTOMER_LIST_ZONE,
} from "../utils/admin-layout";

/*

Deja el widget "Alta de colaborador" arriba de todo en Admin → Clientes,
sobre la tabla, para todos los usuarios del Admin.

Desde Medusa 2.21 el Admin ordena las páginas con un "layout" configurable:
los sufijos `.before` / `.after` de las zonas se ignoran y los widgets
quedan DEBAJO del contenido del core (orden 0, después de la tabla). El orden
se cambia con la configuración de layout de la zona, que puede ser personal
(cada usuario, desde "Personalizar" en el Admin) o la predeterminada del
sistema, que es la que fija este script: el widget con `order: -1`.

Es un migration script: `medusa db:migrate` lo corre UNA vez por base de
datos (DEV, QA, PRD) y queda registrado. Conserva lo que ya tenga la
configuración predeterminada de la zona (otros widgets).

Un usuario que guarde su propio layout de Clientes ve el suyo, no este.

*/
export default async function adminLayoutAltaColaborador({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const settings = container.resolve<ISettingsModuleService>(Modules.SETTINGS);

  const current = await settings.getSystemDefaultLayoutConfiguration(CUSTOMER_LIST_ZONE);
  const widgets = {
    ...((current?.configuration as any)?.widgets ?? {}),
    [`widget:${ALTA_COLABORADOR_WIDGET_ID}`]: { order: -1 },
  };

  await settings.setSystemDefaultLayoutConfiguration(CUSTOMER_LIST_ZONE, { widgets } as any);

  logger.info(`Layout predeterminado de "${CUSTOMER_LIST_ZONE}": "Alta de colaborador" arriba de la tabla.`);
}
