import { queryOptions, useMutation } from "@tanstack/react-query";
import type { Client } from "openapi-fetch";

import { useApi } from "@/api/api-context";
import { unwrap } from "@/api/problem";
import type { paths } from "@/api/schema.gen";

export const sessionKeys = { me: ["session", "me"] as const };

export function meQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: sessionKeys.me,
    queryFn: async () => unwrap(await api.GET("/me")),
  });
}

export function useLogin() {
  const api = useApi();
  return useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      await unwrap(await api.POST("/session", { body: credentials }));
    },
  });
}

export function useDeleteSession() {
  const api = useApi();
  return useMutation({
    mutationFn: async () => {
      await unwrap(await api.DELETE("/session"));
    },
  });
}
