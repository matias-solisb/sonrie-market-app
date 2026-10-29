import { Container, Text, toast } from "@medusajs/ui";
import { useNavigate, useParams } from "react-router-dom";
import { AnnouncementForm } from "../../../components/announcements/announcement-form";
import {
  useAnnouncement,
  useUpdateAnnouncement,
} from "../../../hooks/api/announcements";

const EditAnnouncementPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isPending, isError } = useAnnouncement(id!);
  const { mutateAsync, isPending: isSaving } = useUpdateAnnouncement(id!);

  if (isPending) {
    return (
      <Container>
        <Text size="small">Cargando...</Text>
      </Container>
    );
  }

  if (isError || !data) {
    return (
      <Container>
        <Text size="small">No se encontró el anuncio.</Text>
      </Container>
    );
  }

  return (
    <AnnouncementForm
      key={data.announcement.id}
      title="Editar anuncio"
      initial={data.announcement}
      isSubmitting={isSaving}
      onSubmit={async (payload) => {
        try {
          await mutateAsync(payload);
          toast.success("Anuncio guardado");
          navigate("/announcements");
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : "No se pudo guardar el anuncio"
          );
        }
      }}
    />
  );
};

export default EditAnnouncementPage;
