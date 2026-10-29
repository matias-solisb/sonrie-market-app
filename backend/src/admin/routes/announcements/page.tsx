import { defineRouteConfig } from "@medusajs/admin-sdk";
import { BellAlert, CogSixTooth, PencilSquare, Trash } from "@medusajs/icons";
import {
  Badge,
  Button,
  Container,
  Heading,
  IconButton,
  Input,
  Prompt,
  Select,
  Switch,
  Table,
  Text,
  toast,
} from "@medusajs/ui";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnnouncementSettingsModal } from "../../components/announcements/announcement-settings-modal";
import {
  AdminAnnouncement,
  useAnnouncements,
  useDeleteAnnouncement,
  useUpdateAnnouncement,
} from "../../hooks/api/announcements";
import { formatSantiago } from "../../lib/santiago-time";

const PAGE_SIZE = 20;

/*

Barra de anuncios: avisos cortos que se muestran sobre el header del
storefront (equivalente a "Marketing > Barra de anuncios" de la
plataforma legacy). Si hay varios vigentes, rotan; colores, intervalo y
lugares se editan en el engranaje (configuración general).

*/
const AnnouncementsPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState<"todos" | "true" | "false">("todos");
  const [page, setPage] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Búsqueda con debounce para no pedir en cada tecla.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setQ(search.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const { data, isPending } = useAnnouncements({
    q: q || undefined,
    activo: estado === "todos" ? undefined : estado,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });

  const announcements = data?.announcements ?? [];
  const count = data?.count ?? 0;
  const from = count === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min(count, (page + 1) * PAGE_SIZE);

  return (
    <Container className="flex flex-col p-0 overflow-hidden">
      <div className="flex items-center justify-between gap-4 p-6">
        <div>
          <Heading className="font-sans font-medium h1-core">
            Barra de anuncios
          </Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Avisos que se muestran sobre el header de la tienda. Si hay más de
            uno vigente, rotan.
          </Text>
        </div>
        <div className="flex items-center gap-2">
          <IconButton
            variant="primary"
            onClick={() => setSettingsOpen(true)}
            aria-label="Configuración general"
            title="Configuración general"
          >
            <CogSixTooth />
          </IconButton>
          <Button size="small" onClick={() => navigate("/announcements/create")}>
            Crear nuevo anuncio
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 px-6 pb-4">
        <Input
          type="search"
          size="small"
          placeholder="Buscar por título del anuncio"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-72"
        />
        <div className="w-44">
          <Select
            size="small"
            value={estado}
            onValueChange={(value) => {
              setEstado(value as typeof estado);
              setPage(0);
            }}
          >
            <Select.Trigger>
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="todos">Todos los estados</Select.Item>
              <Select.Item value="true">Activos</Select.Item>
              <Select.Item value="false">Inactivos</Select.Item>
            </Select.Content>
          </Select>
        </div>
      </div>

      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Título</Table.HeaderCell>
            <Table.HeaderCell>Descripción</Table.HeaderCell>
            <Table.HeaderCell>Vigencia</Table.HeaderCell>
            <Table.HeaderCell>Estado</Table.HeaderCell>
            <Table.HeaderCell className="w-24" />
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {announcements.map((announcement) => (
            <AnnouncementRow key={announcement.id} announcement={announcement} />
          ))}
        </Table.Body>
      </Table>

      {isPending && (
        <Text className="px-6 py-4" size="small">
          Cargando...
        </Text>
      )}
      {!isPending && announcements.length === 0 && (
        <Text className="px-6 py-4 text-ui-fg-subtle" size="small">
          {q || estado !== "todos"
            ? "No hay anuncios que coincidan con la búsqueda."
            : "Todavía no hay anuncios."}
        </Text>
      )}

      <div className="flex items-center justify-end gap-3 border-t px-6 py-3">
        <Text size="small" className="text-ui-fg-subtle">
          {from}-{to} de {count}
        </Text>
        <Button
          variant="transparent"
          size="small"
          disabled={page === 0}
          onClick={() => setPage((p) => p - 1)}
        >
          Anterior
        </Button>
        <Button
          variant="transparent"
          size="small"
          disabled={to >= count}
          onClick={() => setPage((p) => p + 1)}
        >
          Siguiente
        </Button>
      </div>

      <AnnouncementSettingsModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
    </Container>
  );
};

const vigenciaLabel = (a: AdminAnnouncement) => {
  if (!a.fecha_inicio && !a.fecha_fin) {
    return "–";
  }
  const desde = a.fecha_inicio ? formatSantiago(a.fecha_inicio) : "…";
  const hasta = a.fecha_fin ? formatSantiago(a.fecha_fin) : "…";
  return `${desde} – ${hasta}`;
};

const estadoVigencia = (a: AdminAnnouncement) => {
  const now = Date.now();
  if (a.fecha_fin && new Date(a.fecha_fin).getTime() <= now) {
    return { label: "Expirado", color: "grey" as const };
  }
  if (a.fecha_inicio && new Date(a.fecha_inicio).getTime() > now) {
    return { label: "Programado", color: "blue" as const };
  }
  return null;
};

const AnnouncementRow = ({
  announcement,
}: {
  announcement: AdminAnnouncement;
}) => {
  const navigate = useNavigate();
  const { mutateAsync: update } = useUpdateAnnouncement(announcement.id);
  const { mutateAsync: remove, isPending: isDeleting } = useDeleteAnnouncement(
    announcement.id
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const badge = estadoVigencia(announcement);

  const handleToggle = async (checked: boolean) => {
    try {
      await update({ activo: checked });
    } catch {
      toast.error("No se pudo actualizar el anuncio");
    }
  };

  const handleDelete = async () => {
    try {
      await remove(undefined);
      toast.success("Anuncio eliminado");
      setConfirmOpen(false);
    } catch {
      toast.error("No se pudo eliminar el anuncio");
    }
  };

  return (
    <Table.Row
      className="cursor-pointer"
      onClick={() => navigate(`/announcements/${announcement.id}`)}
    >
      <Table.Cell className="max-w-[200px] truncate">
        {announcement.nombre}
      </Table.Cell>
      <Table.Cell className="max-w-[480px]">
        <span className="line-clamp-2 whitespace-normal">
          {announcement.texto}
        </span>
      </Table.Cell>
      <Table.Cell className="whitespace-nowrap">
        <div className="flex flex-col gap-1">
          <span>{vigenciaLabel(announcement)}</span>
          {badge && (
            <Badge size="2xsmall" color={badge.color} className="w-fit">
              {badge.label}
            </Badge>
          )}
        </div>
      </Table.Cell>
      <Table.Cell onClick={(e) => e.stopPropagation()}>
        <Switch
          checked={announcement.activo}
          onCheckedChange={handleToggle}
          aria-label={announcement.activo ? "Desactivar" : "Activar"}
        />
      </Table.Cell>
      <Table.Cell onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          <Link to={`/announcements/${announcement.id}`}>
            <IconButton variant="transparent" aria-label="Editar anuncio">
              <PencilSquare />
            </IconButton>
          </Link>
          <IconButton
            variant="transparent"
            onClick={() => setConfirmOpen(true)}
            aria-label="Eliminar anuncio"
          >
            <Trash className="text-ui-fg-error" />
          </IconButton>
        </div>
        <Prompt open={confirmOpen} onOpenChange={setConfirmOpen}>
          <Prompt.Content>
            <Prompt.Header>
              <Prompt.Title>Eliminar anuncio</Prompt.Title>
              <Prompt.Description>
                Se eliminará «{announcement.nombre}» y dejará de mostrarse en
                la tienda. Si solo quieres ocultarlo, desactívalo.
              </Prompt.Description>
            </Prompt.Header>
            <Prompt.Footer>
              <Prompt.Cancel>Cancelar</Prompt.Cancel>
              <Prompt.Action onClick={handleDelete} disabled={isDeleting}>
                Eliminar
              </Prompt.Action>
            </Prompt.Footer>
          </Prompt.Content>
        </Prompt>
      </Table.Cell>
    </Table.Row>
  );
};

export const config = defineRouteConfig({
  label: "Barra de anuncios",
  icon: BellAlert,
});

export default AnnouncementsPage;
