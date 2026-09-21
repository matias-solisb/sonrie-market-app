import { Container, clx } from "@/modules/common/components/ui"
import Image from "next/image"
import React from "react"

import PlaceholderImage from "@/modules/common/icons/placeholder-image"

type ThumbnailProps = {
  thumbnail?: string | null
  images?: { url?: string }[] | null
  size?: "small" | "medium" | "large" | "full" | "square"
  isFeatured?: boolean
  // "Destacado" ribbon: refleja el product tag "featured" del producto
  // (ver paginated-products.tsx, p.tags). El multiplier badge de abajo
  // sigue siendo un valor de demostración.
  destacado?: boolean
  multiplier?: number
  className?: string
  // Mantenido por compatibilidad con llamadas existentes del B2B Starter
  // (ej. cart item-full) que aún pasan `type="full"|"preview"` para el
  // padding interno de la imagen.
  type?: "preview" | "full"
  "data-testid"?: string
}

const Thumbnail: React.FC<ThumbnailProps> = ({
  thumbnail,
  images,
  size = "small",
  isFeatured,
  destacado,
  multiplier,
  className,
  "data-testid": dataTestid,
  type,
}) => {
  const initialImage = thumbnail || images?.[0]?.url

  return (
    <Container
      className={clx(
        "relative w-full overflow-hidden p-4 bg-ui-bg-subtle shadow-elevation-card-rest rounded-large group-hover:shadow-elevation-card-hover transition-shadow ease-in-out duration-150",
        className,
        {
          "aspect-[11/14]": isFeatured,
          "aspect-[9/16]": !isFeatured && size !== "square",
          "aspect-[1/1]": size === "square",
          "w-[180px]": size === "small",
          "w-[290px]": size === "medium",
          "w-[440px]": size === "large",
          "w-full": size === "full",
        }
      )}
      data-testid={dataTestid}
    >
      {destacado && (
        <div
          className="absolute left-0 top-3 z-10 bg-red-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-sm"
          data-testid="destacado-ribbon"
        >
          Destacado
        </div>
      )}
      <ImageOrPlaceholder image={initialImage} size={size} type={type} />
      {multiplier != null && (
        <div
          className="absolute bottom-2 right-2 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-ui-border-base bg-white text-xs font-bold text-ui-fg-base shadow-md"
          data-testid="multiplier-badge"
        >
          {multiplier}x
        </div>
      )}
    </Container>
  )
}

const ImageOrPlaceholder = ({
  image,
  size,
  type,
}: Pick<ThumbnailProps, "size" | "type"> & { image?: string }) => {
  return image ? (
    <Image
      src={image}
      alt="Thumbnail"
      className={clx("absolute inset-0 object-contain object-center", {
        "p-4": type === "full",
        "p-2": type === "preview",
      })}
      draggable={false}
      quality={50}
      sizes="(max-width: 576px) 280px, (max-width: 768px) 360px, (max-width: 992px) 480px, 800px"
      fill
    />
  ) : (
    <div className="w-full h-full absolute inset-0 flex items-center justify-center">
      <PlaceholderImage size={size === "small" ? 16 : 24} />
    </div>
  )
}

export default Thumbnail
