import { FetchError } from "@medusajs/js-sdk";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sdk } from "../../lib/client";
import { queryKeysFactory } from "../../lib/query-key-factory";

/*

Cuenta del colaborador (rut-auth, paso 9): estado y habilitación.

GET  /admin/colaboradores/:customerId
POST /admin/colaboradores/:customerId/habilitacion  { enabled }

*/

export type AdminColaborador = {
  rut: string;
  enabled: boolean;
  enabled_changed_at: string | null;
  enabled_changed_by: string | null;
  must_change_password: boolean;
  locked_until: string | null;
};

export const colaboradorQueryKey = queryKeysFactory("colaborador");

export const useColaborador = (customerId: string) =>
  useQuery<{ colaborador: AdminColaborador }, FetchError>({
    queryKey: colaboradorQueryKey.detail(customerId),
    queryFn: () =>
      sdk.client.fetch<{ colaborador: AdminColaborador }>(
        `/admin/colaboradores/${customerId}`,
        { method: "GET" }
      ),
    enabled: Boolean(customerId),
    // 404 = el cliente no es colaborador: no tiene sentido reintentar.
    retry: (count, error) => error?.status !== 404 && count < 2,
  });

export const useSetColaboradorHabilitacion = (customerId: string) => {
  const queryClient = useQueryClient();

  return useMutation<
    { colaborador: Partial<AdminColaborador> },
    FetchError,
    { enabled: boolean }
  >({
    mutationFn: (body) =>
      sdk.client.fetch(`/admin/colaboradores/${customerId}/habilitacion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: colaboradorQueryKey.detail(customerId),
      });
    },
  });
};
