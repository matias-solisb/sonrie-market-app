import { getBaseURL } from "@/lib/util/env"
import { Toaster } from "@medusajs/ui"
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter"
import { Analytics } from "@vercel/analytics/next"
import { GeistSans } from "geist/font/sans"
import { Metadata } from "next"
import "@/styles/globals.css"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" data-mode="light" className={GeistSans.variable}>
      <body>
        {/*
          `AppRouterCacheProvider` es de `@mui/material-nextjs` — es lo que
          hace que Material UI (Emotion) inserte sus estilos correctamente
          con el App Router de Next (si no está, el date picker de MUI que
          se agregó en `document-filters` puede parpadear sin estilos en la
          primera carga). No cambia nada visualmente por sí solo — el resto
          del sitio sigue siendo 100% Tailwind + @medusajs/ui, esto solo
          prepara el mecanismo para el/los componentes MUI puntuales que sí
          se usan (ver `src/lib/mui/date-picker-provider.tsx`).
        */}
        <AppRouterCacheProvider>
          <main className="relative">{props.children}</main>
          <Toaster className="z-[99999]" position="bottom-left" />
          <Analytics />
        </AppRouterCacheProvider>
      </body>
    </html>
  )
}
