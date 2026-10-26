import { FetchError } from "@medusajs/js-sdk";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sdk } from "../../lib/client";
import { queryKeysFactory } from "../../lib/query-key-factory";

/*

Cuenta del colaborador: alta, estado y habilitación.

POST /admin/colaboradores                           { rut, email, first_name, last_name, phone? }
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

export type AdminAltaColaboradorBody = {
  rut: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
};

export type AdminAltaColaboradorResponse = {
  colaborador: {
    status: "creado" | "vinculado";
    customer_id: string;
    employee_id: string;
  };
};

export const useAltaColaborador = () => {
  const queryClient = useQueryClient();

  return useMutation<AdminAltaColaboradorResponse, FetchError, AdminAltaColaboradorBody>({
    mutationFn: (body) =>
      sdk.client.fetch(`/admin/colaboradores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      }),
    onSuccess: () => {
      // Lista de Clientes del core ("customers") y la propia ("customer").
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer"] });
    },
  });
};
