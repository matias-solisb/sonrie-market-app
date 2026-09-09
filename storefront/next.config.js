const checkEnvVariables = require("./check-env-variables")

checkEnvVariables()

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  images: {
    // Next.js exige declarar acá cada valor de `quality` usado en
    // `<Image quality={...} />` en el sitio (hoy: 50, en los thumbnails
    // de productos/pedidos/aprobaciones/cotizaciones, y 100, en
    // `sign-in-prompt`) — sin esto solo avisa por consola, pero a partir
    // de Next.js 16 se vuelve obligatorio y esas imágenes dejarían de
    // renderizar. Ver next-image-unconfigured-qualities en los docs.
    qualities: [50, 100],
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
      },
      {
        protocol: "https",
        hostname: "medusa-public-images.s3.eu-west-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "medusa-server-testing.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "medusa-server-testing.s3.us-east-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "github.com",
      },
      {
        // Ilustraciones/banners tomados directamente del sitio de
        // referencia de diseño (ver hero, nav, footer, login).
        protocol: "https",
        hostname: "sonrie.youorder.me",
      },
      {
        // Bucket S3 donde viven esas mismas imágenes de referencia (logo,
        // banners del hero, etc. — ver LOGO_URL en nav/footer/mobile-menu
        // y SLIDES en modules/home/components/hero).
        protocol: "https",
        hostname: "s3.amazonaws.com",
      },
    ],
  },
}

module.exports = nextConfig
