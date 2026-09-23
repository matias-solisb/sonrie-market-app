import { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { SONRIE_LOGO_URL } from "@/lib/constants"

export const metadata: Metadata = {
  title: "404",
  description: "Página no encontrada",
}

// Ilustración tomada directamente del sitio ya desplegado (sonrie.youorder.me),
// que es la referencia de diseño para este proyecto.
const ILLUSTRATION_URL =
  "https://sonrie.youorder.me/assets/illustrations/characters/character_6.png"

// Ícono exacto de "Need help?" del sitio de referencia — es "settings-bold"
// del set Iconify "Solar" (no venía en @medusajs/icons ni en ningún otro
// set ya instalado, así que se reproduce como SVG inline en vez de agregar
// una librería de iconos nueva solo por este uso).
const HelpIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} role="img" aria-hidden="true">
    <g fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        opacity={0.5}
        d="M14.2788 2.15224C13.9085 2 13.439 2 12.5 2C11.561 2 11.0915 2 10.7212 2.15224C10.2274 2.35523 9.83509 2.74458 9.63056 3.23463C9.53719 3.45834 9.50065 3.7185 9.48635 4.09799C9.46534 4.65568 9.17716 5.17189 8.69017 5.45093C8.20318 5.72996 7.60864 5.71954 7.11149 5.45876C6.77318 5.2813 6.52789 5.18262 6.28599 5.15102C5.75609 5.08178 5.22018 5.22429 4.79616 5.5472C4.47814 5.78938 4.24339 6.1929 3.7739 6.99993C3.30441 7.80697 3.06967 8.21048 3.01735 8.60491C2.94758 9.1308 3.09118 9.66266 3.41655 10.0835C3.56506 10.2756 3.77377 10.437 4.0977 10.639C4.57391 10.936 4.88032 11.4419 4.88029 12C4.88026 12.5581 4.57386 13.0639 4.0977 13.3608C3.77372 13.5629 3.56497 13.7244 3.41645 13.9165C3.09108 14.3373 2.94749 14.8691 3.01725 15.395C3.06957 15.7894 3.30432 16.193 3.7738 17C4.24329 17.807 4.47804 18.2106 4.79606 18.4527C5.22008 18.7756 5.75599 18.9181 6.28589 18.8489C6.52778 18.8173 6.77305 18.7186 7.11133 18.5412C7.60852 18.2804 8.2031 18.27 8.69012 18.549C9.17714 18.8281 9.46533 19.3443 9.48635 19.9021C9.50065 20.2815 9.53719 20.5417 9.63056 20.7654C9.83509 21.2554 10.2274 21.6448 10.7212 21.8478C11.0915 22 11.561 22 12.5 22C13.439 22 13.9085 22 14.2788 21.8478C14.7726 21.6448 15.1649 21.2554 15.3694 20.7654C15.4628 20.5417 15.4994 20.2815 15.5137 19.902C15.5347 19.3443 15.8228 18.8281 16.3098 18.549C16.7968 18.2699 17.3914 18.2804 17.8886 18.5412C18.2269 18.7186 18.4721 18.8172 18.714 18.8488C19.2439 18.9181 19.7798 18.7756 20.2038 18.4527C20.5219 18.2105 20.7566 17.807 21.2261 16.9999C21.6956 16.1929 21.9303 15.7894 21.9827 15.395C22.0524 14.8691 21.9088 14.3372 21.5835 13.9164C21.4349 13.7243 21.2262 13.5628 20.9022 13.3608C20.4261 13.0639 20.1197 12.558 20.1197 11.9999C20.1197 11.4418 20.4261 10.9361 20.9022 10.6392C21.2263 10.4371 21.435 10.2757 21.5836 10.0835C21.9089 9.66273 22.0525 9.13087 21.9828 8.60497C21.9304 8.21055 21.6957 7.80703 21.2262 7C20.7567 6.19297 20.522 5.78945 20.2039 5.54727C19.7799 5.22436 19.244 5.08185 18.7141 5.15109C18.4722 5.18269 18.2269 5.28136 17.8887 5.4588C17.3915 5.71959 16.7969 5.73002 16.3099 5.45096C15.8229 5.17191 15.5347 4.65566 15.5136 4.09794C15.4993 3.71848 15.4628 3.45833 15.3694 3.23463C15.1649 2.74458 14.7726 2.35523 14.2788 2.15224Z"
      />
      <path d="M15.5227 12C15.5227 13.6569 14.1694 15 12.4999 15C10.8304 15 9.47705 13.6569 9.47705 12C9.47705 10.3431 10.8304 9 12.4999 9C14.1694 9 15.5227 10.3431 15.5227 12Z" />
    </g>
  </svg>
)

// Fondo decorativo detrás del personaje: una "nube" ancha (armada con
// círculos superpuestos, la técnica clásica para este tipo de forma en
// SVG) más un sol y un par de nubes chicas, en los mismos colores de acento
// (celeste/naranjo) que usa el sitio de referencia. El degradé (mismos
// colores/coordenadas confirmados en el devtools del sitio original) va de
// azul opaco abajo-izquierda a transparente arriba-derecha. viewBox 480x300
// para que la forma sea ancha (como en la referencia) en vez de cuadrada.
/* const IllustrationBackground = () => (
  <svg
    viewBox="0 0 480 300"
    className="absolute inset-0 h-full w-full"
    aria-hidden="true"
  >
    <defs>
      <linearGradient
        id="notFoundBlobGradient"
        x1="19.5%"
        y1="71.8%"
        x2="77.5%"
        y2="16.7%"
      >
        <stop offset="0%" stopColor="#004b93" />
        <stop offset="100%" stopColor="#004b93" stopOpacity={0} />
      </linearGradient>
    </defs>

    <g fill="url(#notFoundBlobGradient)" opacity={0.2}>
      <ellipse cx="240" cy="175" rx="185" ry="100" />
      <circle cx="120" cy="130" r="65" />
      <circle cx="360" cy="130" r="65" />
      <circle cx="190" cy="95" r="55" />
      <circle cx="290" cy="95" r="55" />
    </g>

    <circle cx="95" cy="95" r="26" fill="#FFD666" />

    <g fill="#ffffff">
      <ellipse cx="70" cy="205" rx="26" ry="15" />
      <ellipse cx="52" cy="200" rx="15" ry="11" />
      <ellipse cx="400" cy="130" rx="24" ry="14" />
      <ellipse cx="418" cy="125" rx="14" ry="10" />
    </g>
  </svg>
) */

// Esta es la 404 "raíz" (fuera de [countryCode]/(main)) — se muestra cuando
// la URL ni siquiera matchea un país, así que no hereda el header normal
// del sitio (barra roja, buscador, carrito). Por eso tiene su propio header
// minimalista, igual al del sitio de referencia.
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="flex items-center justify-between px-6 py-6 sm:px-10">
        <Link href="/" className="flex items-center shrink-0">
          <Image
            src={SONRIE_LOGO_URL}
            alt="Sonríe Market"
            width={140}
            height={40}
            className="h-14 w-auto"
          />
        </Link>

        {/* TODO: no existe todavía una página de ayuda/soporte en el
            proyecto — placeholder hasta que se construya esa página. */}
        <a
          href="#"
          className="flex items-center gap-x-2 text-base-regular font-semibold text-ui-fg-subtle hover:text-ui-fg-base"
          data-testid="not-found-help-link"
        >
          <HelpIcon className="h-5 w-5 text-ui-fg-muted" />
          Need help?
        </a>
      </header>

      <div className="flex flex-1 flex-col items-center px-6 pt-16 text-center sm:pt-4">
        <h1 className="text-2xl-semi text-ui-fg-base sm:text-3xl-semi">
          ¡Lo siento, página no encontrada!
        </h1>
        <p className="mt-4 max-w-md text-base-regular text-ui-fg-subtle">
          Lo sentimos, no pudimos encontrar la página que estás buscando.
          ¿Quizás has escrito mal la URL? Asegúrate de revisar tu ortografía.
        </p>

        <Link
          href="/"
          className="mt-12 flex h-11 items-center justify-center rounded-md bg-gray-900 px-8 font-semibold text-white hover:bg-gray-800"
          data-testid="not-found-home-link"
        >
          Ir a Inicio
        </Link>
      </div>
    </div>
  )
}
