import { listBanners } from "@/lib/data/banners"
import { getRegion, listRegions } from "@/lib/data/regions"
import FeaturedProducts from "@/modules/home/components/featured-products"
import Hero from "@/modules/home/components/hero"
import SkeletonFeaturedProducts from "@/modules/skeletons/templates/skeleton-featured-products"
import { Metadata } from "next"
import { Suspense } from "react"

export const dynamicParams = true

export const metadata: Metadata = {
  title: "Sonríe Market",
  description: "Tienda interna de Sonríe Market.",
}

export async function generateStaticParams() {
  const countryCodes = await listRegions().then(
    (regions) =>
      regions
        ?.map((r) => r.countries?.map((c) => c.iso_2))
        .flat()
        .filter(Boolean) as string[]
  )
  return countryCodes.map((countryCode) => ({ countryCode }))
}

const FeaturedProductsSection = async ({
  countryCode,
}: {
  countryCode: string
}) => {
  const region = await getRegion(countryCode)

  if (!region) {
    return null
  }

  return <FeaturedProducts region={region} countryCode={countryCode} />
}

export default async function Home(props: {
  params: Promise<{ countryCode: string }>
}) {
  const params = await props.params

  const { countryCode } = params

  const slides = await listBanners()

  return (
    <div className="flex flex-col gap-y-2 m-2">
      <Hero slides={slides} />
      <Suspense fallback={<SkeletonFeaturedProducts />}>
        <FeaturedProductsSection countryCode={countryCode} />
      </Suspense>
    </div>
  )
}
