import { FetchError } from "@medusajs/js-sdk";
import {
  QueryKey,
  useMutation,
  UseMutationOptions,
  useQuery,
  useQueryClient,
  UseQueryOptions,
} from "@tanstack/react-query";
import { queryKeysFactory } from "../../lib/query-key-factory";
import { sdk } from "../../lib/client";

export type AdminBanner = {
  id: string;
  image_url: string;
  orden: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type AdminBannersResponse = {
  banners: AdminBanner[];
  count: number;
  offset: number;
  limit: number;
};

export type AdminBannerResponse = {
  banner: AdminBanner;
};

export type AdminCreateBanner = {
  image_url: string;
  orden?: number;
  activo?: boolean;
};

export type AdminUpdateBanner = {
  image_url?: string;
  orden?: number;
  activo?: boolean;
};

export const bannerQueryKey = queryKeysFactory("banner");

export const useBanners = (
  query?: Record<string, any>,
  options?: UseQueryOptions<
    AdminBannersResponse,
    FetchError,
    AdminBannersResponse,
    QueryKey
  >
) => {
  const filterQuery = new URLSearchParams(query).toString();

  const fetchBanners = async () =>
    sdk.client.fetch<AdminBannersResponse>(
      `/admin/banners${filterQuery ? `?${filterQuery}` : ""}`,
      {
        method: "GET",
      }
    );

  return useQuery({
    queryKey: bannerQueryKey.list(query),
    queryFn: fetchBanners,
    ...options,
  });
};

export const useCreateBanner = (
  options?: UseMutationOptions<
    AdminBannerResponse,
    FetchError,
    AdminCreateBanner
  >
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (banner: AdminCreateBanner) =>
      sdk.client.fetch<AdminBannerResponse>("/admin/banners", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: banner,
      }),
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({ queryKey: bannerQueryKey.lists() });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};

export const useUpdateBanner = (
  bannerId: string,
  options?: UseMutationOptions<
    AdminBannerResponse,
    FetchError,
    AdminUpdateBanner
  >
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (banner: AdminUpdateBanner) =>
      sdk.client.fetch<AdminBannerResponse>(`/admin/banners/${bannerId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: banner,
      }),
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({ queryKey: bannerQueryKey.lists() });
      queryClient.invalidateQueries({
        queryKey: bannerQueryKey.detail(bannerId),
      });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};

export const useDeleteBanner = (
  bannerId: string,
  options?: UseMutationOptions<void, FetchError>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      sdk.client.fetch<void>(`/admin/banners/${bannerId}`, {
        method: "DELETE",
      }),
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({ queryKey: bannerQueryKey.lists() });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};

// El panel manda el array de IDs en el orden visual resultante del
// drag-and-drop; nunca se edita el número de `orden` a mano.
export const useReorderBanners = (
  options?: UseMutationOptions<
    { banners: AdminBanner[] },
    FetchError,
    string[]
  >
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) =>
      sdk.client.fetch<{ banners: AdminBanner[] }>("/admin/banners/reorder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: { ids },
      }),
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({ queryKey: bannerQueryKey.lists() });
      options?.onSuccess?.(data, variables, context);
    },
    ...options,
  });
};
