import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { Client } from "openapi-fetch";

import { useApi } from "@/api/api-context";
import { unwrap } from "@/api/problem";
import type { components, paths } from "@/api/schema.gen";

export type BackupStatus = components["schemas"]["BackupStatus"];
export type VersionStatus = components["schemas"]["VersionStatus"];

export const diagnosticURL = "/api/v1/instance/diagnostic";

const instanceKeys = {
  backup: ["instance", "backup"] as const,
  version: ["instance", "version"] as const,
};

export function backupQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: instanceKeys.backup,
    queryFn: async () => unwrap(await api.GET("/instance/backup")),
  });
}

export function useRunBackup() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => unwrap(await api.POST("/instance/backup")),
    onSuccess: (status) => {
      queryClient.setQueryData(instanceKeys.backup, status);
    },
  });
}

export function useSetCopyPassword() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (password: string) =>
      unwrap(
        await api.PUT("/instance/backup/copy-password", {
          body: { password },
        }),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: instanceKeys.backup }),
  });
}

export function versionQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: instanceKeys.version,
    queryFn: async () => unwrap(await api.GET("/instance/version")),
  });
}

export function useSetUpdateCheck() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updateCheck: boolean) =>
      unwrap(
        await api.PUT("/instance/version/update-check", {
          body: { update_check: updateCheck },
        }),
      ),
    onSuccess: (status) => {
      queryClient.setQueryData(instanceKeys.version, status);
    },
  });
}
