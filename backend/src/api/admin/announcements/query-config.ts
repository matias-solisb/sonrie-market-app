export const adminAnnouncementFields = [
  "id",
  "nombre",
  "texto",
  "link",
  "icono",
  "posicion_icono",
  "fecha_inicio",
  "fecha_fin",
  "activo",
  "created_at",
  "updated_at",
];

export const adminAnnouncementQueryConfig = {
  list: {
    defaults: adminAnnouncementFields,
    isList: true,
  },
  retrieve: {
    defaults: adminAnnouncementFields,
    isList: false,
  },
};
