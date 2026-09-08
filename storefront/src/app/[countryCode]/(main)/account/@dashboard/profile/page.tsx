import { retrieveCustomer } from "@/lib/data/customer"
import { listRegions } from "@/lib/data/regions"
import CreditPanel from "@/modules/account/components/credit-panel"
import ProfileCard from "@/modules/account/components/profile-card"
import { Metadata } from "next"
import { notFound } from "next/navigation"

export const metadata: Metadata = {
  title: "Profile",
  description: "View and edit your Medusa Store profile.",
}

export default async function Profile() {
  const customer = await retrieveCustomer()
  const regions = await listRegions()

  if (!customer || !regions) {
    notFound()
  }

  return (
    <div className="w-full" data-testid="profile-page-wrapper">
      <div className="grid grid-cols-1 small:grid-cols-[1fr_320px] gap-4 items-start">
        <ProfileCard customer={customer} />
        <CreditPanel customer={customer} />
      </div>
    </div>
  )
}
