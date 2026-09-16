import { defineRouteConfig } from "@medusajs/admin-sdk";
import { DotsSix, Photo, Plus, Trash } from "@medusajs/icons";
import {
  Button,
  Container,
  Heading,
  IconButton,
  Switch,
  Text,
  Toaster,
  toast,
} from "@medusajs/ui";
import { DragEvent, useRef, useState } from "react";
import { DeletePrompt } from "../../components/common/delete-prompt";
import { Thumbnail } from "../../components/common/thumbnail";
import {
  AdminBanner,
  useBanners,
  useCreateBanner,
  useDeleteBanner,
  useReorderBanners,
  useUpdateBanner,
} from "../../hooks/api/banners";
import { sdk } from "../../lib/client";

const Banners = () => {
  const { data, isPending } = useBanners();
  const banners = [...(data?.banners ?? [])].sort(
    (a, b) => a.orden - b.orden
  );

  const { mutateAsync: reorder } = useReorderBanners();
  const { mutateAsync: createBanner, isPending: isCreating } =
    useCreateBanner();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Reordenamiento por drag-and-drop: el usuario nunca escribe el
  // número de `orden`, solo arrastra filas. Al soltar se manda el
  // array completo de IDs en el nuevo orden visual.
  const handleDrop = async (targetId: string) => {
    const currentDraggedId = draggedId;
    setDraggedId(null);

    if (!currentDraggedId || currentDraggedId === targetId) {
      return;
    }

    const ids = banners.map((banner) => banner.id);
    const fromIndex = ids.indexOf(currentDraggedId);
    const toIndex = ids.indexOf(targetId);

    if (fromIndex === -1 || toIndex === -1) {
      return;
    }

    ids.splice(fromIndex, 1);
    ids.splice(toIndex, 0, currentDraggedId);

    try {
      await reorder(ids);
    } catch (err) {
      toast.error("No se pudo reordenar los banners");
    }
  };

  const handleFileSelected = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setIsUploading(true);

    try {
      const { files } = await sdk.admin.upload.create({ files: [file] });
      const uploaded = files?.[0];

      if (!uploaded?.url) {
        throw new Error("La subida no devolvió una URL de imagen");
      }

      const maxOrden = banners.reduce(
        (max, banner) => Math.max(max, banner.orden),
        -1
      );

      await createBanner({
        image_url: uploaded.url,
        orden: maxOrden + 1,
        activo: true,
      });

      toast.success("Banner agregado");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo subir la imagen"
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Container className="flex flex-col p-0 overflow-hidden">
      <div className="flex items-center justify-between p-6">
        <div>
          <Heading className="font-sans font-medium h1-core">
            Banners del home
          </Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Arrastra para reordenar. Solo los banners activos se muestran en
            el carrusel de la tienda.
          </Text>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelected}
          />
          <Button
            variant="secondary"
            size="small"
            isLoading={isUploading || isCreating}
            onClick={() => fileInputRef.current?.click()}
          >
            <Plus />
            Agregar banner
          </Button>
        </div>
      </div>

      {isPending && (
        <Text className="px-6 pb-6" size="small">
          Cargando...
        </Text>
      )}

      {!isPending && banners.length === 0 && (
        <Text className="px-6 pb-6" size="small">
          Todavía no hay banners cargados.
        </Text>
      )}

      <div className="flex flex-col">
        {banners.map((banner) => (
          <BannerRow
            key={banner.id}
            banner={banner}
            isDragging={draggedId === banner.id}
            onDragStart={() => setDraggedId(banner.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => handleDrop(banner.id)}
          />
        ))}
      </div>
      <Toaster />
    </Container>
  );
};

type BannerRowProps = {
  banner: AdminBanner;
  isDragging: boolean;
  onDragStart: () => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: () => void;
};

const BannerRow = ({
  banner,
  isDragging,
  onDragStart,
  onDragOver,
  onDrop,
}: BannerRowProps) => {
  const { mutateAsync: updateBanner } = useUpdateBanner(banner.id);
  const { mutateAsync: deleteBanner, isPending: isDeleting } =
    useDeleteBanner(banner.id);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleToggleActivo = async (checked: boolean) => {
    try {
      await updateBanner({ activo: checked });
    } catch (err) {
      toast.error("No se pudo actualizar el banner");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteBanner();
      toast.success("Banner eliminado");
    } catch (err) {
      toast.error("No se pudo eliminar el banner");
    }
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`flex items-center gap-4 border-t px-6 py-3 ${
        isDragging ? "opacity-40" : ""
      }`}
      data-testid={`banner-row-${banner.id}`}
    >
      <DotsSix className="text-ui-fg-muted cursor-grab" />
      <Thumbnail src={banner.image_url} alt="banner" />
      <div className="min-w-0 flex-1">
        <Text size="small" className="truncate text-ui-fg-subtle">
          {banner.image_url}
        </Text>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={banner.activo} onCheckedChange={handleToggleActivo} />
        <Text size="xsmall" className="w-14 text-ui-fg-subtle">
          {banner.activo ? "Activo" : "Inactivo"}
        </Text>
      </div>
      <IconButton
        variant="transparent"
        onClick={() => setConfirmOpen(true)}
        aria-label="Eliminar banner"
      >
        <Trash className="text-ui-fg-error" />
      </IconButton>
      <DeletePrompt
        open={confirmOpen}
        setOpen={setConfirmOpen}
        loading={isDeleting}
        handleDelete={handleDelete}
      />
    </div>
  );
};

export const config = defineRouteConfig({
  label: "Banners",
  icon: Photo,
});

export default Banners;
