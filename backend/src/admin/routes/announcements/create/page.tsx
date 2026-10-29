import { toast } from "@medusajs/ui";
import { useNavigate } from "react-router-dom";
import { AnnouncementForm } from "../../../components/announcements/announcement-form";
import { useCreateAnnouncement } from "../../../hooks/api/announcements";

const CreateAnnouncementPage = () => {
  const navigate = useNavigate();
  const { mutateAsync, isPending } = useCreateAnnouncement();

  return (
    <AnnouncementForm
      title="Nuevo anuncio"
      isSubmitting={isPending}
      onSubmit={async (payload) => {
        try {
          await mutateAsync(payload);
          toast.success("Anuncio creado");
          navigate("/announcements");
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : "No se pudo crear el anuncio"
          );
        }
      }}
    />
  );
};

export default CreateAnnouncementPage;
