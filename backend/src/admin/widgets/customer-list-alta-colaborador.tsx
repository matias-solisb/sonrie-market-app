import { defineWidgetConfig } from "@medusajs/admin-sdk";
import {
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Text,
  toast,
} from "@medusajs/ui";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  AdminAltaColaboradorBody,
  useAltaColaborador,
} from "../hooks/api/colaboradores";
import { formatRutInput, isValidRut } from "../../utils/rut";

/*

Widget "Alta de colaborador" en la lista de Clientes (Admin → Clientes).

Pone el botón "Dar de alta" en el encabezado de la tabla, en el lugar del
"Crear" del core (que queda oculto): ver useAnclaCrear, abajo. Si no
encuentra ese lugar, muestra un recuadro "Alta de colaborador" sobre la tabla
con el mismo botón (plan B).

Crea la cuenta completa del colaborador con POST /admin/colaboradores:
identidad RUT + cliente + employee de Soprole (la company única). Es lo mismo
que el script alta-colaborador (src/utils/colaborador-alta.ts).

- Campo RUT: igual que el del login de la tienda. Pone puntos y guion
  mientras se escribe, descarta lo que no sea dígito o K (también al
  pegar), deja la K solo al final y corta en 9 caracteres; el DV se valida
  antes de enviar (el backend lo vuelve a validar).
- No se pide clave: la inicial son los últimos 4 dígitos del RUT antes del DV
  y se cambia en el primer ingreso.
- Si el RUT ya es colaborador, no crea nada y lo dice (409).
- Al terminar abre la ficha del cliente, donde está "Acceso a la tienda".
- El recuadro del plan B va arriba de todo, sobre la tabla. Desde Medusa 2.21
  eso no lo da la zona (`.before` se ignora) sino el layout predeterminado de
  "customer.list", que fija el migration script admin-layout-alta-colaborador
  con el `id` de abajo.
- Sin `required` nativo en los campos: el Input de @medusajs/ui pinta de rojo
  los campos requeridos vacíos apenas se abre el formulario. Se valida al
  enviar.
- El "Crear" del core (POST /admin/customers) está bloqueado: crea clientes
  que no pueden entrar a la tienda (ver api/middlewares/self-signup-disabled.ts).
  Además el widget oculta su botón con CSS (OCULTAR_CREAR_CORE, abajo).

⚠️ Sin RBAC (Fase 2), cualquier usuario del Admin puede usarlo.

*/

/*
Oculta el botón "Crear" del core en la lista de Clientes.

El SDK del Admin no permite quitar botones del core (solo agregar widgets).
El botón lleva a /customers/create en las dos versiones de la tabla del
dashboard (la normal y la configurable), así que se ocultan los enlaces que
terminan ahí. La regla solo existe mientras el widget está montado, es decir,
en la lista de Clientes.

⚠️ Depende del markup del dashboard (@medusajs/dashboard 2.21): revisar al
actualizar Medusa. Si deja de calzar, el botón vuelve a verse pero sigue
bloqueado en el backend (403). Con RBAC (Fase 2) se puede reemplazar quitando
el permiso customer:create (el botón está en un PermissionGuard).
*/
const OCULTAR_CREAR_CORE = `a[href$="/customers/create"] { display: none !important; }`;

/*
Lugar del botón "Dar de alta": un <span> que se inserta justo antes del
enlace "Crear" (oculto) del encabezado de la tabla, y que el widget llena
con un portal de React.

El encabezado lo dibuja el core DESPUÉS que el widget y puede volver a
dibujarlo (al filtrar, paginar, etc.), así que un MutationObserver lo busca
mientras el widget está montado y vuelve a insertar el <span> si se pierde.
Si en ESPERA_MS no aparece el enlace, `buscando` pasa a false y el widget
muestra el recuadro del plan B. Si el enlace aparece más tarde, el botón
vuelve al encabezado y el recuadro desaparece.

⚠️ Igual que OCULTAR_CREAR_CORE, depende del markup del dashboard
(@medusajs/dashboard 2.21): revisar al actualizar Medusa. Si deja de calzar,
el resultado es el plan B (recuadro), nunca quedarse sin botón.
*/
const SELECTOR_CREAR_CORE = 'a[href$="/customers/create"]';
const ESPERA_MS = 3000;

const useAnclaCrear = () => {
  const [ancla, setAncla] = useState<HTMLElement | null>(null);
  const [buscando, setBuscando] = useState(true);

  useEffect(() => {
    const host = document.createElement("span");
    host.className = "contents";
    host.dataset.testid = "alta-colaborador-ancla";

    const ubicar = () => {
      const crear = document.querySelector(SELECTOR_CREAR_CORE);
      if (!crear?.parentElement) {
        if (host.isConnected) {
          host.remove();
          setAncla(null);
        }
        return;
      }
      if (host.parentElement !== crear.parentElement || host.nextSibling !== crear) {
        crear.parentElement.insertBefore(host, crear);
      }
      setAncla(host);
    };

    ubicar();
    const observer = new MutationObserver(ubicar);
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = setTimeout(() => setBuscando(false), ESPERA_MS);

    return () => {
      observer.disconnect();
      clearTimeout(timer);
      host.remove();
    };
  }, []);

  return { ancla, buscando };
};

const VACIO: AdminAltaColaboradorBody = {
  rut: "",
  email: "",
  first_name: "",
  last_name: "",
  phone: "",
};

const CAMPOS: {
  name: keyof AdminAltaColaboradorBody;
  label: string;
  placeholder: string;
  type?: string;
  required: boolean;
}[] = [
  { name: "rut", label: "RUT", placeholder: "12.345.678-5", required: true },
  { name: "email", label: "Correo", placeholder: "juana.perez@soprole.cl", type: "email", required: true },
  { name: "first_name", label: "Nombre", placeholder: "Juana", required: true },
  { name: "last_name", label: "Apellido", placeholder: "Pérez Soto", required: true },
  { name: "phone", label: "Teléfono (opcional)", placeholder: "+56 9 1234 5678", type: "tel", required: false },
];

const CustomerListAltaColaboradorWidget = () => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AdminAltaColaboradorBody>(VACIO);
  const [error, setError] = useState<{ message: string } | null>(null);
  const [rutTocado, setRutTocado] = useState(false);
  const rutInvalido = Boolean(form.rut) && !isValidRut(form.rut);
  const { mutateAsync, isPending } = useAltaColaborador();
  const navigate = useNavigate();
  const { ancla, buscando } = useAnclaCrear();

  const onOpenChange = (value: boolean) => {
    setOpen(value);
    if (!value) {
      setForm(VACIO);
      setError(null);
      setRutTocado(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isValidRut(form.rut)) {
      setRutTocado(true);
      return;
    }

    const faltan = CAMPOS.filter((c) => c.required && !String(form[c.name] ?? "").trim());
    if (faltan.length) {
      setError({ message: `Completa: ${faltan.map((c) => c.label.toLowerCase()).join(", ")}.` });
      return;
    }

    try {
      const { colaborador } = await mutateAsync({
        ...form,
        phone: form.phone?.trim() || null,
      });

      toast.success(
        colaborador.status === "creado"
          ? "Colaborador creado. Su clave inicial son los últimos 4 dígitos del RUT (antes del dígito verificador)."
          : "El RUT ya tenía cuenta: quedó vinculado a Soprole."
      );
      onOpenChange(false);
      navigate(`/customers/${colaborador.customer_id}`);
    } catch (e: any) {
      // FetchError no trae el body; el 409 de "ya existe" se reconoce por el status.
      setError({
        message:
          e?.message ||
          (e?.status === 409 ? "Ese RUT ya es colaborador." : "No se pudo crear el colaborador."),
      });
    }
  };

  const botonDarDeAlta = (
    <Button
      size="small"
      variant={ancla ? "secondary" : "primary"}
      onClick={() => setOpen(true)}
      data-testid="alta-colaborador-abrir"
    >
      Dar de alta
    </Button>
  );

  return (
    <>
      <style>{OCULTAR_CREAR_CORE}</style>

      {ancla && createPortal(botonDarDeAlta, ancla)}

      {/* Plan B: no se encontró el lugar del "Crear" del core. */}
      {!ancla && !buscando && (
        <Container className="flex items-center justify-between px-6 py-4" data-testid="alta-colaborador-recuadro">
          <div>
            <Heading level="h2">Alta de colaborador</Heading>
            <Text size="small" className="text-ui-fg-subtle">
              Crea la cuenta para que el colaborador entre a la tienda con su RUT.
            </Text>
          </div>
          {botonDarDeAlta}
        </Container>
      )}

      <Drawer open={open} onOpenChange={onOpenChange}>
        <Drawer.Content>
          <form onSubmit={onSubmit} className="flex h-full flex-col">
            <Drawer.Header>
              <Drawer.Title>Alta de colaborador</Drawer.Title>
            </Drawer.Header>

            <Drawer.Body className="flex flex-col gap-4 p-4">
              {CAMPOS.map((campo) => {
                const esRut = campo.name === "rut";
                const mostrarErrorRut = esRut && rutTocado && (!form.rut || rutInvalido);

                return (
                  <div key={campo.name} className="flex flex-col gap-2">
                    <Label size="xsmall" htmlFor={`alta-${campo.name}`}>
                      {campo.label}
                    </Label>
                    <Input
                      id={`alta-${campo.name}`}
                      name={campo.name}
                      type={campo.type ?? "text"}
                      placeholder={campo.placeholder}
                      value={form[campo.name] ?? ""}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          [campo.name]: esRut ? formatRutInput(e.target.value) : e.target.value,
                        })
                      }
                      {...(esRut && {
                        // "text" y no "numeric": el DV puede ser K. Sin
                        // maxLength: el navegador cortaría lo pegado antes de
                        // limpiarlo; el largo lo limita formatRutInput.
                        inputMode: "text" as const,
                        autoCapitalize: "characters",
                        autoComplete: "off",
                        onBlur: () => setRutTocado(true),
                        "aria-invalid": mostrarErrorRut,
                        "data-testid": "alta-colaborador-rut",
                      })}
                    />
                    {mostrarErrorRut && (
                      <Text size="small" className="text-ui-fg-error">
                        {form.rut ? "El RUT no es válido" : "El RUT es requerido"}
                      </Text>
                    )}
                  </div>
                );
              })}

              <Text size="small" className="text-ui-fg-subtle">
                No hay que definir clave: la inicial son los últimos 4 dígitos
                del RUT antes del dígito verificador, y se le pedirá cambiarla
                en su primer ingreso.
              </Text>

              {error && (
                <Text size="small" className="text-ui-fg-error" data-testid="alta-colaborador-error">
                  {error.message}
                </Text>
              )}
            </Drawer.Body>

            <Drawer.Footer>
              <Drawer.Close asChild>
                <Button variant="secondary" size="small" type="button">
                  Cancelar
                </Button>
              </Drawer.Close>
              <Button size="small" type="submit" isLoading={isPending} data-testid="alta-colaborador-guardar">
                Crear colaborador
              </Button>
            </Drawer.Footer>
          </form>
        </Drawer.Content>
      </Drawer>
    </>
  );
};

export const config = defineWidgetConfig({
  zone: "customer.list.before",
  // Texto literal a propósito: el plugin del Admin lee el id del código
  // fuente y no resuelve constantes. Debe ser igual a ALTA_COLABORADOR_WIDGET_ID
  // (src/utils/admin-layout.ts), que usa el migration script.
  id: "sonrie:alta-colaborador",
});

export default CustomerListAltaColaboradorWidget;
