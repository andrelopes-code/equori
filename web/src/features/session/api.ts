import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { Client } from "openapi-fetch";

import { useApi } from "@/api/api-context";
import { unwrap } from "@/api/problem";
import type { paths } from "@/api/schema.gen";
import { useAppLocale } from "@/i18n/i18n-provider";
import type { Language } from "@/i18n/languages";

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

// Applies the language at once and stores it in the profile; the answer replaces the cached
// profile so a remount of ProfileLocale does not reapply the old one.
export function useChooseLanguage(): (language: Language) => void {
  const api = useApi();
  const queryClient = useQueryClient();
  const [, setLanguage] = useAppLocale();
  const update = useMutation({
    mutationFn: async (language: Language) =>
      unwrap(await api.PATCH("/me", { body: { language } })),
    onSuccess: (me) => {
      queryClient.setQueryData(meQuery(api).queryKey, me);
    },
  });
  return (language) => {
    setLanguage(language);
    update.mutate(language);
  };
}
