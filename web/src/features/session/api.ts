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

export const sessionKeys = {
  me: ["session", "me"] as const,
  setup: ["session", "setup"] as const,
};

export function meQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: sessionKeys.me,
    queryFn: async () => unwrap(await api.GET("/me")),
  });
}

// Whether the first user is still to be created (W-U2 of the Windows design).
export function setupQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: sessionKeys.setup,
    queryFn: async () => unwrap(await api.GET("/setup")),
  });
}

export type SetupInput =
  paths["/setup"]["post"]["requestBody"]["content"]["application/json"];

// The answer is the new admin, signed in by the cookie of the same response.
export function useCompleteSetup() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SetupInput) =>
      unwrap(await api.POST("/setup", { body: input })),
    onSuccess: (me) => {
      queryClient.setQueryData(meQuery(api).queryKey, me);
      queryClient.setQueryData(setupQuery(api).queryKey, { required: false });
    },
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
