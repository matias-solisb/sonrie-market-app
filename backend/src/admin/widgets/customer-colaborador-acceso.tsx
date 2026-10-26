import { defineWidgetConfig } from "@medusajs/admin-sdk";
import { AdminCustomer, DetailWidgetProps } from "@medusajs/framework/types";
import {
  Badge,
  Button,
  Container,
  Heading,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui";
import {
  useColaborador,
  useSetColaboradorHabilitacion,
} from "../hooks/api/colaboradores";
import { formatRut } from "../../utils/rut";

/*

Widget "Acceso a la tienda" en el detalle del cliente (Admin → Clientes →
detalle). rut-auth, paso 9.

Muestra el RUT del colaborador y el estado de su cuenta (habilitada, cambio
de clave pendiente, bloqueo por intentos) y permite deshabilitarla o volver a
habilitarla, con confirmación.

Deshabilitar: no puede entrar, sus sesiones abiertas se cortan en el
siguiente request y no recibe el correo de recuperación. No borra nada.

Si el cliente no es colaborador (sin RUT), el widget no se muestra.

⚠️ Sin RBAC (Fase 2), cualquier usuario del Admin puede usarlo.

*/

const fecha = (iso: string) =>
  new Intl.DateTimeFormat("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Santiago",
  }).format(new Date(iso));

const CustomerColaboradorAccesoWidget = ({
  data: customer,
}: DetailWidgetProps<AdminCustomer>) => {
  const { data, isLoading, error } = useColaborador(customer.id);
  const { mutateAsync, isPending } = useSetColaboradorHabilitacion(customer.id);
  const prompt = usePrompt();

  // No es colaborador (sin identidad RUT): nada que mostrar.
  if (error?.status === 404) {
    return null;
  }

  const colaborador = data?.colaborador;

  const cambiar = async (enabled: boolean) => {
    const nombre =
      [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
      customer.email;

    const confirmed = await prompt({
      title: enabled ? "Habilitar colaborador" : "Deshabilitar colaborador",
      description: enabled
        ? `${nombre} podrá volver a entrar a la tienda con su misma contraseña.`
        : `${nombre} no podrá entrar a la tienda y sus sesiones abiertas se cerrarán. Su cuenta, sus pedidos y su historial no se borran.`,
      confirmText: enabled ? "Habilitar" : "Deshabilitar",
      cancelText: "Cancelar",
    });

    if (!confirmed) {
      return;
    }

    try {
      await mutateAsync({ enabled });
      toast.success(enabled ? "Colaborador habilitado." : "Colaborador deshabilitado.");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar el cambio.");
    }
  };

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Acceso a la tienda</Heading>
        {colaborador &&
          (colaborador.enabled ? (
            <Badge color="green" size="2xsmall">Habilitado</Badge>
          ) : (
            <Badge color="red" size="2xsmall">Deshabilitado</Badge>
          ))}
      </div>

      {isLoading && (
        <div className="px-6 py-4">
          <Text size="small" className="text-ui-fg-subtle">Cargando…</Text>
        </div>
      )}

      {error && error.status !== 404 && (
        <div className="px-6 py-4">
          <Text size="small" className="text-ui-fg-error">
            No se pudo cargar el estado de la cuenta.
          </Text>
        </div>
      )}

      {colaborador && (
        <>
          <div className="grid grid-cols-2 gap-y-2 px-6 py-4">
            <Text size="small" weight="plus">RUT</Text>
            <Text size="small" data-testid="colaborador-rut">{formatRut(colaborador.rut) ?? colaborador.rut}</Text>

            <Text size="small" weight="plus">Contraseña</Text>
            <Text size="small">
              {colaborador.must_change_password
                ? "Inicial (debe cambiarla al entrar)"
                : "Definida por el colaborador"}
            </Text>

            <Text size="small" weight="plus">Bloqueo por intentos</Text>
            <Text size="small">
              {colaborador.locked_until
                ? `Bloqueada hasta ${fecha(colaborador.locked_until)}`
                : "No"}
            </Text>

            {colaborador.enabled_changed_at && (
              <>
                <Text size="small" weight="plus">
                  {colaborador.enabled ? "Habilitado el" : "Deshabilitado el"}
                </Text>
                <Text size="small">{fecha(colaborador.enabled_changed_at)}</Text>
              </>
            )}
          </div>

          <div className="flex justify-end px-6 py-4">
            {colaborador.enabled ? (
              <Button
                variant="danger"
                size="small"
                isLoading={isPending}
                onClick={() => cambiar(false)}
                data-testid="colaborador-deshabilitar"
              >
                Deshabilitar
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="small"
                isLoading={isPending}
                onClick={() => cambiar(true)}
                data-testid="colaborador-habilitar"
              >
                Habilitar
              </Button>
            )}
          </div>
        </>
      )}
    </Container>
  );
};

export const config = defineWidgetConfig({
  zone: "customer.details.after",
});

export default CustomerColaboradorAccesoWidget;
