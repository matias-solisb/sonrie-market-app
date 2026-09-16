export const adminBannerFields = [
  "id",
  "image_url",
  "orden",
  "activo",
  "created_at",
  "updated_at",
]

export const adminBannerQueryConfig = {
  list: {
    defaults: adminBannerFields,
    isList: true,
  },
  retrieve: {
    defaults: adminBannerFields,
    isList: false,
  },
}
