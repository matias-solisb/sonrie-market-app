import { FetchError } from "@medusajs/js-sdk";
import {
  useMutation,
  UseMutationOptions,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { sdk } from "../../lib/client";
import { queryKeysFactory } from "../../lib/query-key-factory";

export type AdminBenefitBudget = {
  campaign_id: string;
  campaign_nombre: string;
  budget_id: string | null;
  periodo: string;
  tope: number;
  tope_override: number | null;
  consumido: number;
  disponible: number;
};

export type AdminBenefitMovement = {
  id: string;
  tipo: "consumo" | "reintegro";
  monto: number;
  order_id: string | null;
  order_display_id: number | null;
  created_at: string;
};

export type AdminCustomerBenefitBudgetResponse = {
  benefit_budget: AdminBenefitBudget | null;
  movimientos: AdminBenefitMovement[];
};

export type AdminSetTopeOverride = {
  periodo?: string;
  tope_override: number | null;
};

export const benefitBudgetQueryKey = queryKeysFactory("benefit_budget");

export const useCustomerBenefitBudget = (
  customerId: string,
  periodo?: string
) => {
  const query = periodo ? `?periodo=${encodeURIComponent(periodo)}` : "";

  return useQuery({
    queryKey: benefitBudgetQueryKey.detail(customerId, { periodo }),
    queryFn: () =>
      sdk.client.fetch<AdminCustomerBenefitBudgetResponse>(
        `/admin/benefit-budget/customers/${customerId}${query}`,
        { method: "GET" }
      ),
    enabled: Boolean(customerId),
  });
};

export const useSetBenefitTopeOverride = (
  customerId: string,
  options?: UseMutationOptions<
    { benefit_budget: AdminBenefitBudget },
    FetchError,
    AdminSetTopeOverride
  >
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: AdminSetTopeOverride) =>
      sdk.client.fetch<{ benefit_budget: AdminBenefitBudget }>(
        `/admin/benefit-budget/customers/${customerId}/override`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        }
      ),
    ...options,
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({
        queryKey: benefitBudgetQueryKey.details(),
      });
      options?.onSuccess?.(data, variables, context);
    },
  });
};

// ── Campañas (página "Beneficio") ─────────────────────────────────────

export type AdminBenefitCampaign = {
  id: string;
  nombre: string;
  descripcion: string | null;
  tope_por_colaborador: number;
  periodo: "mensual" | "rango";
  estado: "activa" | "inactiva";
  created_at: string;
  updated_at: string;
};

export type AdminBenefitCampaignsResponse = {
  campaigns: AdminBenefitCampaign[];
  /** "YYYY-MM" en hora de Santiago. */
  periodo_actual: string;
  periodo_siguiente: string;
};

export type AdminBenefitCampaignChange = {
  id: string;
  created_at: string;
  cambios: Record<string, { anterior: unknown; nuevo: unknown }>;
  rige_desde: string | null;
  actor: {
    id: string;
    email: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
};

export type AdminUpdateBenefitCampaign = {
  nombre?: string;
  descripcion?: string | null;
  tope_por_colaborador?: number;
  estado?: "activa" | "inactiva";
};

export const benefitCampaignQueryKey = queryKeysFactory("benefit_campaign");

export const useBenefitCampaigns = () =>
  useQuery({
    queryKey: benefitCampaignQueryKey.lists(),
    queryFn: () =>
      sdk.client.fetch<AdminBenefitCampaignsResponse>(
        "/admin/benefit-budget/campaigns",
        { method: "GET" }
      ),
  });

export const useBenefitCampaignChanges = (campaignId?: string) =>
  useQuery({
    queryKey: benefitCampaignQueryKey.detail(campaignId ?? "", {
      cambios: true,
    }),
    queryFn: () =>
      sdk.client.fetch<{ cambios: AdminBenefitCampaignChange[] }>(
        `/admin/benefit-budget/campaigns/${campaignId}/cambios`,
        { method: "GET" }
      ),
    enabled: Boolean(campaignId),
  });

export const useUpdateBenefitCampaign = (
  campaignId: string,
  options?: UseMutationOptions<
    { campaign: AdminBenefitCampaign; rige_desde: string | null },
    FetchError,
    AdminUpdateBenefitCampaign
  >
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: AdminUpdateBenefitCampaign) =>
      sdk.client.fetch<{
        campaign: AdminBenefitCampaign;
        rige_desde: string | null;
      }>(`/admin/benefit-budget/campaigns/${campaignId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      }),
    ...options,
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: benefitCampaignQueryKey.all });
      // Los saldos sin fila del mes muestran el tope de la campaña
      queryClient.invalidateQueries({ queryKey: benefitBudgetQueryKey.all });
      options?.onSuccess?.(data, variables, context);
    },
  });
};
