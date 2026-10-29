import {
  Button,
  Checkbox,
  FocusModal,
  Heading,
  Input,
  Label,
  Switch,
  Text,
  toast,
} from "@medusajs/ui";
import { useEffect, useState } from "react";
import {
  ANNOUNCEMENT_PLACES,
  AnnouncementPlace,
  MAX_INTERVALO_SEGUNDOS,
  MIN_INTERVALO_SEGUNDOS,
} from "../../../modules/announcements/constants";
import {
  useAnnouncementSettings,
  useUpdateAnnouncementSettings,
} from "../../hooks/api/announcements";
import { AnnouncementBarPreview } from "./announcement-bar-preview";
import { ANNOUNCEMENT_PLACE_LABELS } from "./announcement-icons";

const HEX = /^#[0-9a-fA-F]{6}$/;

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

// "Configuración general" (engranaje): intervalo de rotación, lugares
// donde se muestra la barra y colores. Aplica a todos los anuncios.
export const AnnouncementSettingsModal = ({ open, onOpenChange }: Props) => {
  const { data } = useAnnouncementSettings();
  const { mutateAsync, isPending } = useUpdateAnnouncementSettings();

  const [intervalo, setIntervalo] = useState("5");
  const [lugares, setLugares] = useState<AnnouncementPlace[]>([]);
  const [fondo, setFondo] = useState("#E01441");
  const [texto, setTexto] = useState("#FFFFFF");
  const [conBorde, setConBorde] = useState(false);
  const [borde, setBorde] = useState("#FFFFFF");

  useEffect(() => {
    const s = data?.settings;
    if (!s || !open) {
      return;
    }
    setIntervalo(String(s.intervalo_segundos));
    setLugares(s.lugares);
    setFondo(s.color_fondo);
    setTexto(s.color_texto);
    setConBorde(!!s.color_borde);
    setBorde(s.color_borde ?? "#FFFFFF");
  }, [data, open]);

  const intervaloNum = Number(intervalo);
  const intervaloValido =
    Number.isInteger(intervaloNum) &&
    intervaloNum >= MIN_INTERVALO_SEGUNDOS &&
    intervaloNum <= MAX_INTERVALO_SEGUNDOS;
  const coloresValidos =
    HEX.test(fondo) && HEX.test(texto) && (!conBorde || HEX.test(borde));

  const toggleLugar = (lugar: AnnouncementPlace, checked: boolean) =>
    setLugares((prev) =>
      checked ? [...prev, lugar] : prev.filter((value) => value !== lugar)
    );

  const handleSave = async () => {
    try {
      await mutateAsync({
        intervalo_segundos: intervaloNum,
        lugares,
        color_fondo: fondo,
        color_texto: texto,
        color_borde: conBorde ? borde : null,
      });
      toast.success("Configuración guardada");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo guardar"
      );
    }
  };

  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      <FocusModal.Content>
        <FocusModal.Header>
          <FocusModal.Title asChild>
            <Heading>Configuración general</Heading>
          </FocusModal.Title>
        </FocusModal.Header>
        <FocusModal.Body className="flex justify-center overflow-y-auto py-10">
          <div className="flex w-full max-w-[640px] flex-col gap-y-6 px-4">
            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Intervalo de rotación (segundos)
              </Label>
              <Input
                type="number"
                min={MIN_INTERVALO_SEGUNDOS}
                max={MAX_INTERVALO_SEGUNDOS}
                value={intervalo}
                onChange={(e) => setIntervalo(e.target.value)}
              />
              <Text
                size="xsmall"
                className={intervaloValido ? "text-ui-fg-subtle" : "text-ui-fg-error"}
              >
                Entre {MIN_INTERVALO_SEGUNDOS} y {MAX_INTERVALO_SEGUNDOS}{" "}
                segundos. Solo aplica si hay más de un anuncio vigente.
              </Text>
            </div>

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Lugares donde mostrar
              </Label>
              <Text size="xsmall" className="text-ui-fg-subtle">
                Selecciona los lugares donde se mostrará el anuncio.
              </Text>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ANNOUNCEMENT_PLACES.map((lugar) => (
                  <div key={lugar} className="flex items-center gap-2">
                    <Checkbox
                      id={`lugar-${lugar}`}
                      checked={lugares.includes(lugar)}
                      onCheckedChange={(checked) =>
                        toggleLugar(lugar, checked === true)
                      }
                    />
                    <Label htmlFor={`lugar-${lugar}`} size="small">
                      {ANNOUNCEMENT_PLACE_LABELS[lugar]}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <ColorField label="Color del fondo" value={fondo} onChange={setFondo} />
            <ColorField label="Color del texto" value={texto} onChange={setTexto} />

            <div className="flex flex-col gap-y-2">
              <div className="flex items-center gap-2">
                <Switch
                  id="con-borde"
                  checked={conBorde}
                  onCheckedChange={setConBorde}
                />
                <Label htmlFor="con-borde" size="small" weight="plus">
                  Borde inferior
                </Label>
              </div>
              {conBorde && (
                <ColorField label="Color del borde" value={borde} onChange={setBorde} />
              )}
            </div>

            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Vista previa
              </Label>
              <AnnouncementBarPreview
                texto="¡Periodo de compra cerrado! La entrega de los pedidos será el jueves en tu site."
                icono="camion"
                color_fondo={HEX.test(fondo) ? fondo : undefined}
                color_texto={HEX.test(texto) ? texto : undefined}
                color_borde={conBorde && HEX.test(borde) ? borde : null}
              />
            </div>
          </div>
        </FocusModal.Body>
        <FocusModal.Footer>
          <div className="flex items-center justify-end gap-2">
            <FocusModal.Close asChild>
              <Button variant="secondary" size="small">
                Cancelar
              </Button>
            </FocusModal.Close>
            <Button
              size="small"
              onClick={handleSave}
              isLoading={isPending}
              disabled={!intervaloValido || !coloresValidos}
            >
              Guardar
            </Button>
          </div>
        </FocusModal.Footer>
      </FocusModal.Content>
    </FocusModal>
  );
};

const ColorField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) => (
  <div className="flex flex-col gap-y-2">
    <Label size="small" weight="plus">
      {label}
    </Label>
    <div className="flex items-center gap-3">
      <input
        type="color"
        aria-label={label}
        value={HEX.test(value) ? value : "#000000"}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        className="h-8 w-10 cursor-pointer rounded border border-ui-border-base bg-transparent"
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-32 font-mono"
        maxLength={7}
      />
    </div>
  </div>
);
