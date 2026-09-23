import Image from "next/image"
import type { ReactNode } from "react"

import { SONRIE_LOGO_URL } from "@/lib/constants"
import { FormSubmitButton } from "@/modules/common/components/form"

/*

Card compartida por Login, Recuperar contraseña y Restablecer contraseña:
mismo borde, mismo logo y mismo botón principal. Antes cada uno tenía su
copia del logo y de las clases; ahora cambian acá.

*/
export const AuthCard = ({
  children,
  "data-testid": dataTestId,
}: {
  children: ReactNode
  "data-testid"?: string
}) => (
  <div
    className="w-full max-w-md rounded-md border border-ui-border-base p-6 sm:p-8"
    data-testid={dataTestId}
  >
    <Image
      src={SONRIE_LOGO_URL}
      alt="Sonríe Market"
      width={320}
      height={88}
      className="mx-auto mb-6 h-16 w-auto sm:mb-8 sm:h-24"
    />
    {children}
  </div>
)

export const AuthTitle = ({ children }: { children: ReactNode }) => (
  <h1 className="text-xl-semi text-ui-fg-base sm:text-2xl-semi">{children}</h1>
)

export const AuthText = ({ children }: { children: ReactNode }) => (
  <p className="mt-3 text-base-regular text-ui-fg-subtle">{children}</p>
)

// Botón principal de las cards de auth: el `FormSubmitButton` compartido,
// a todo el ancho y separado de los campos.
export const AuthSubmitButton = ({
  isPending,
  label,
  pendingLabel,
  "data-testid": dataTestId,
}: {
  isPending: boolean
  label: string
  pendingLabel: string
  "data-testid"?: string
}) => (
  <FormSubmitButton
    isPending={isPending}
    pendingLabel={pendingLabel}
    fullWidth
    className="mt-6"
    data-testid={dataTestId}
  >
    {label}
  </FormSubmitButton>
)
