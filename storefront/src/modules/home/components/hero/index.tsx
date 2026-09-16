"use client"

import { ChevronLeftMini, ChevronRightMini } from "@medusajs/icons"
import Image from "next/image"
import { useEffect, useState } from "react"

import LocalizedClientLink from "@/modules/common/components/localized-client-link"
import { StoreBanner } from "@/lib/data/banners"

const AUTOPLAY_MS = 6000

type HeroProps = {
  slides: StoreBanner[]
}

const Hero = ({ slides }: HeroProps) => {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (slides.length < 2) {
      return
    }

    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length)
    }, AUTOPLAY_MS)

    return () => clearInterval(timer)
  }, [slides.length])

  if (slides.length === 0) {
    return null
  }

  const goTo = (index: number) => {
    setCurrent((index + slides.length) % slides.length)
  }

  const slide = slides[current]

  return (
    <div
      className="relative w-full border-b border-ui-border-base bg-white"
      data-testid="hero-carousel"
    >
      {/* Image renders at its own natural aspect ratio, scaled to 100% of the
          viewport width (no fixed-height box, no object-cover/contain) — so
          it always spans edge to edge with nothing cropped or letterboxed. */}
      <LocalizedClientLink
        href="/products"
        className="block w-full"
        data-testid="hero-slide-link"
      >
        <Image
          key={slide.image_url}
          src={slide.image_url}
          alt="banner"
          width={1900}
          height={670}
          className="h-auto w-full"
          sizes="100vw"
          priority={current === 0}
        />
      </LocalizedClientLink>

      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(current - 1)}
            aria-label="Imagen anterior"
            className="absolute left-2 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-ui-fg-base shadow hover:bg-white small:left-4"
            data-testid="hero-prev-button"
          >
            <ChevronLeftMini />
          </button>
          <button
            type="button"
            onClick={() => goTo(current + 1)}
            aria-label="Imagen siguiente"
            className="absolute right-2 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-ui-fg-base shadow hover:bg-white small:right-4"
            data-testid="hero-next-button"
          >
            <ChevronRightMini />
          </button>
        </>
      )}

      {slides.length > 1 && (
        <div className="flex items-center justify-center gap-x-2 py-3">
          {slides.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`Ir a la imagen ${index + 1}`}
              className={`h-2 w-2 rounded-full transition-colors ${
                index === current ? "bg-ui-fg-base" : "bg-gray-300"
              }`}
              data-testid={`hero-dot-${index}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default Hero
