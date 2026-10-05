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
