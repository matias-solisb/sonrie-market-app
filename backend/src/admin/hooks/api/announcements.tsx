import { FetchError } from "@medusajs/js-sdk";
import {
  QueryKey,
  useMutation,
  UseMutationOptions,
  useQuery,
  useQueryClient,
  UseQueryOptions,
} from "@tanstack/react-query";
import type {
  AnnouncementIcon,
  AnnouncementIconPosition,
  AnnouncementPlace,
} from "../../../modules/announcements/constants";
import { sdk } from "../../lib/client";
import { queryKeysFactory } from "../../lib/query-key-factory";

export type AdminAnnouncement = {
  id: string;
  nombre: string;
  texto: string;
  link: string | null;
  icono: AnnouncementIcon | null;
  posicion_icono: AnnouncementIconPosition;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type AdminAnnouncementsResponse = {
  announcements: AdminAnnouncement[];
  count: number;
  offset: number;
  limit: number;
};

export type AdminAnnouncementResponse = { announcement: AdminAnnouncement };

export type AdminAnnouncementPayload = {
  nombre?: string;
  texto?: string;
  link?: string | null;
  icono?: AnnouncementIcon | null;
  posicion_icono?: AnnouncementIconPosition;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  activo?: boolean;
};

export type AdminAnnouncementSettings = {
  id: string;
  intervalo_segundos: number;
  lugares: AnnouncementPlace[];
  color_fondo: string;
  color_texto: string;
  color_borde: string | null;
};

export type AdminAnnouncementSettingsPayload = Partial<
  Omit<AdminAnnouncementSettings, "id">
>;

export const announcementQueryKey = queryKeysFactory("announcement");
const settingsQueryKey = ["announcement", "settings"];

const jsonHeaders = { "Content-Type": "application/json" };

export const useAnnouncements = (
  query?: Record<string, any>,
  options?: Omit<
    UseQueryOptions<
      AdminAnnouncementsResponse,
      FetchError,
      AdminAnnouncementsResponse,
      QueryKey
    >,
    "queryKey" | "queryFn"
  >
) => {
  const params = new URLSearchParams(
    Object.entries(query ?? {}).filter(
      ([, value]) => value !== undefined && value !== ""
    ) as [string, string][]
  ).toString();

  return useQuery({
    queryKey: announcementQueryKey.list(query),
    queryFn: () =>
      sdk.client.fetch<AdminAnnouncementsResponse>(
        `/admin/announcements${params ? `?${params}` : ""}`,
        { method: "GET" }
      ),
    ...options,
  });
};

export const useAnnouncement = (id: string) =>
  useQuery({
    queryKey: announcementQueryKey.detail(id),
    queryFn: () =>
      sdk.client.fetch<AdminAnnouncementResponse>(
        `/admin/announcements/${id}`,
        { method: "GET" }
      ),
  });

export const useCreateAnnouncement = (
  options?: UseMutationOptions<
    AdminAnnouncementResponse,
    FetchError,
    AdminAnnouncementPayload
  >
) => {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: (payload: AdminAnnouncementPayload) =>
      sdk.client.fetch<AdminAnnouncementResponse>("/admin/announcements", {
        method: "POST",
        headers: jsonHeaders,
        body: payload,
      }),
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({
        queryKey: announcementQueryKey.lists(),
      });
      options?.onSuccess?.(data, variables, context);
    },
  });
};

export const useUpdateAnnouncement = (
  id: string,
  options?: UseMutationOptions<
    AdminAnnouncementResponse,
    FetchError,
    AdminAnnouncementPayload
  >
) => {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: (payload: AdminAnnouncementPayload) =>
      sdk.client.fetch<AdminAnnouncementResponse>(
        `/admin/announcements/${id}`,
        { method: "POST", headers: jsonHeaders, body: payload }
      ),
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({
        queryKey: announcementQueryKey.lists(),
      });
      queryClient.invalidateQueries({
        queryKey: announcementQueryKey.detail(id),
      });
      options?.onSuccess?.(data, variables, context);
    },
  });
};

export const useDeleteAnnouncement = (
  id: string,
  options?: UseMutationOptions<void, FetchError>
) => {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: () =>
      sdk.client.fetch<void>(`/admin/announcements/${id}`, {
        method: "DELETE",
      }),
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({
        queryKey: announcementQueryKey.lists(),
      });
      options?.onSuccess?.(data, variables, context);
    },
  });
};

export const useAnnouncementSettings = () =>
  useQuery({
    queryKey: settingsQueryKey,
    queryFn: () =>
      sdk.client.fetch<{ settings: AdminAnnouncementSettings }>(
        "/admin/announcements/settings",
        { method: "GET" }
      ),
  });

export const useUpdateAnnouncementSettings = (
  options?: UseMutationOptions<
    { settings: AdminAnnouncementSettings },
    FetchError,
    AdminAnnouncementSettingsPayload
  >
) => {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: (payload: AdminAnnouncementSettingsPayload) =>
      sdk.client.fetch<{ settings: AdminAnnouncementSettings }>(
        "/admin/announcements/settings",
        { method: "POST", headers: jsonHeaders, body: payload }
      ),
    onSuccess: (data: any, variables: any, context: any) => {
      queryClient.invalidateQueries({ queryKey: settingsQueryKey });
      options?.onSuccess?.(data, variables, context);
    },
  });
};
