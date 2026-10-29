import {
  Button,
  Container,
  Heading,
  Input,
  Label,
  Select,
  Switch,
  Text,
  Textarea,
  clx,
} from "@medusajs/ui";
import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import {
  AnnouncementIcon,
  AnnouncementIconPosition,
  MAX_TEXTO_LENGTH,
} from "../../../modules/announcements/constants";
import {
  AdminAnnouncement,
  AdminAnnouncementPayload,
  useAnnouncementSettings,
} from "../../hooks/api/announcements";
import { isoToSantiagoInput, santiagoInputToIso } from "../../lib/santiago-time";
import { AnnouncementBarPreview } from "./announcement-bar-preview";
import { ANNOUNCEMENT_ICON_OPTIONS } from "./announcement-icons";

type Props = {
  title: string;
  initial?: AdminAnnouncement;
  isSubmitting: boolean;
  onSubmit: (payload: AdminAnnouncementPayload) => Promise<void>;
};

const LINK_REGEX = /^(https?:\/\/[^\s]+|\/(?!\/)[^\s]*)$/i;

/*

Formulario compartido de crear/editar anuncio. Las fechas se escriben en
hora de Chile y se mandan en UTC (lib/santiago-time.ts). Las validaciones
de acá son de comodidad: las reglas reales viven en el backend
(api/admin/announcements/validators.ts).

*/
export const AnnouncementForm = ({
  title,
  initial,
  isSubmitting,
  onSubmit,
}: Props) => {
  const { data: settingsData } = useAnnouncementSettings();
  const settings = settingsData?.settings;

  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [texto, setTexto] = useState(initial?.texto ?? "");
  const [link, setLink] = useState(initial?.link ?? "");
  const [icono, setIcono] = useState<AnnouncementIcon | null>(
    initial?.icono ?? null
  );
  const [posicion, setPosicion] = useState<AnnouncementIconPosition>(
    initial?.posicion_icono ?? "izquierda"
  );
  const [inicio, setInicio] = useState(isoToSantiagoInput(initial?.fecha_inicio));
  const [fin, setFin] = useState(isoToSantiagoInput(initial?.fecha_fin));
  const [activo, setActivo] = useState(initial?.activo ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const next: Record<string, string> = {};
    if (!nombre.trim()) next.nombre = "Ingresa un nombre";
    if (!texto.trim()) next.texto = "Ingresa el texto que verá el colaborador";
    if (link.trim() && !LINK_REGEX.test(link.trim())) {
      next.link = "Debe empezar con https:// o con / (ruta de la tienda)";
    }
    const inicioIso = santiagoInputToIso(inicio);
    const finIso = santiagoInputToIso(fin);
    if (inicioIso && finIso && new Date(finIso) <= new Date(inicioIso)) {
      next.fin = "La fecha de fin debe ser posterior a la de inicio";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validate()) {
      return;
    }
    await onSubmit({
      nombre: nombre.trim(),
      texto: texto.trim(),
      link: link.trim() || null,
      icono,
      posicion_icono: posicion,
      fecha_inicio: santiagoInputToIso(inicio),
      fecha_fin: santiagoInputToIso(fin),
      activo,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <Container className="flex flex-col gap-y-6 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link
              to="/announcements"
              className="txt-compact-small text-ui-fg-subtle hover:text-ui-fg-base"
            >
              ‹ Listado de barras de anuncios
            </Link>
            <Heading className="mt-1">{title}</Heading>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="activo" checked={activo} onCheckedChange={setActivo} />
            <Label htmlFor="activo" size="small">
              {activo ? "Activo" : "Inactivo"}
            </Label>
          </div>
        </div>

        <Field label="Nombre" hint="Solo se ve en el Admin." error={errors.nombre}>
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={120}
            placeholder="Ej: Periodo de compra cerrado"
          />
        </Field>

        <Field
          label="Texto en pantalla"
          hint={`${texto.length}/${MAX_TEXTO_LENGTH}`}
          error={errors.texto}
        >
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={MAX_TEXTO_LENGTH}
            rows={4}
          />
        </Field>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Field
            label="Link (URL)"
            hint="Opcional. https://… o una ruta de la tienda, ej. /products"
            error={errors.link}
          >
            <Input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="/products?promotions=true"
            />
          </Field>

          <Field label="Posición del ícono">
            <Select
              value={posicion}
              onValueChange={(value) =>
                setPosicion(value as AnnouncementIconPosition)
              }
            >
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="izquierda">Izquierda</Select.Item>
                <Select.Item value="derecha">Derecha</Select.Item>
              </Select.Content>
            </Select>
          </Field>
        </div>

        <Field label="Ícono">
          <div className="flex flex-wrap gap-2">
            <IconChoice
              selected={icono === null}
              onClick={() => setIcono(null)}
              label="Ninguno"
            />
            {ANNOUNCEMENT_ICON_OPTIONS.map(({ value, label, Icon }) => (
              <IconChoice
                key={value}
                selected={icono === value}
                onClick={() => setIcono(value)}
                label={label}
                icon={<Icon />}
              />
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Field label="Fecha de inicio" hint="Hora de Chile. Vacío = desde ya.">
            <Input
              type="datetime-local"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
            />
          </Field>
          <Field
            label="Fecha de fin"
            hint="Hora de Chile. Vacío = sin término."
            error={errors.fin}
          >
            <Input
              type="datetime-local"
              value={fin}
              onChange={(e) => setFin(e.target.value)}
            />
          </Field>
        </div>

        <div className="flex flex-col gap-y-2">
          <Label size="small" weight="plus">
            Vista previa
          </Label>
          <AnnouncementBarPreview
            texto={texto}
            icono={icono}
            posicion_icono={posicion}
            color_fondo={settings?.color_fondo}
            color_texto={settings?.color_texto}
            color_borde={settings?.color_borde}
          />
        </div>

        <div className="flex justify-end gap-2">
          <Link to="/announcements">
            <Button type="button" variant="secondary" size="small">
              Cancelar
            </Button>
          </Link>
          <Button type="submit" size="small" isLoading={isSubmitting}>
            Guardar
          </Button>
        </div>
      </Container>
    </form>
  );
};

const Field = ({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-y-2">
    <Label size="small" weight="plus">
      {label}
    </Label>
    {children}
    {error ? (
      <Text size="xsmall" className="text-ui-fg-error">
        {error}
      </Text>
    ) : (
      hint && (
        <Text size="xsmall" className="text-ui-fg-subtle">
          {hint}
        </Text>
      )
    )}
  </div>
);

const IconChoice = ({
  selected,
  onClick,
  label,
  icon,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    title={label}
    aria-label={label}
    aria-pressed={selected}
    className={clx(
      "flex h-9 items-center justify-center gap-1 rounded-md border px-3 txt-compact-small",
      selected
        ? "border-ui-border-interactive bg-ui-bg-highlight text-ui-fg-interactive"
        : "border-ui-border-base text-ui-fg-subtle hover:bg-ui-bg-base-hover"
    )}
  >
    {icon ?? label}
  </button>
);
