"use server"

import { sdk } from "@/lib/config"
import { getAuthHeaders } from "@/lib/data/cookies"
import { FilterType } from "@/types"
import { StoreApprovalsResponse } from "@/types/approval"

type ListApprovalsParams = {
  status?: FilterType
  type?: FilterType
  offset?: number
  limit?: number
  order?: string
}

export const listApprovals = async ({
  status,
  type,
  offset = 0,
  limit = 100,
  order = "-updated_at",
}: ListApprovalsParams = {}) => {
  const headers = {
    ...(await getAuthHeaders()),
  }

  const result = await sdk.client.fetch<StoreApprovalsResponse>(
    `/store/approvals`,
    {
      query: {
        status,
        type,
        offset,
        limit,
        order,
      },
      method: "GET",
      headers,
      credentials: "include",
      // Sin caché: las aprobaciones se resuelven en el Admin, que no puede
      // invalidar la caché del storefront (antes quedaba "pendiente" hasta 24 h).
      cache: "no-store",
    }
  )

  return result
}

/*
Aprobar/rechazar (POST /store/approvals/:id) ya no existe en la tienda: las
aprobaciones se resuelven solo desde el Admin (vulnerabilidad #1).
*/
