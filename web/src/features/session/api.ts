import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { Client } from "openapi-fetch";

import { useApi } from "@/api/api-context";
import { unwrap } from "@/api/problem";
import type { components, paths } from "@/api/schema.gen";
import { reloadHome } from "@/features/session/reload-home";
import { useAppLocale } from "@/i18n/i18n-provider";
import type { Language } from "@/i18n/languages";

export const sessionKeys = {
  me: ["session", "me"] as const,
  setup: ["session", "setup"] as const,
  books: ["session", "books"] as const,
};

export type BooksMembership = components["schemas"]["BooksMembership"];
export type InvitationPreview = components["schemas"]["InvitationPreview"];
export type AcceptInvitationInput =
  components["schemas"]["AcceptInvitationInput"];

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

// GET /me/books, the items in books ID order.
export function myBooksQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: sessionKeys.books,
    queryFn: async () => {
      const { items } = await unwrap(await api.GET("/me/books"));
      return [...items].sort((a, b) => a.id - b.id);
    },
  });
}

// PUT /session/books; the reload reads the session under the new book.
export function useSwitchBooks() {
  const api = useApi();
  return useMutation({
    mutationFn: async (booksId: number) => {
      await unwrap(
        await api.PUT("/session/books", { body: { books_id: booksId } }),
      );
    },
    onSuccess: reloadHome,
  });
}

// POST /invitations/preview; a 404 is final, so the query does not retry.
export function invitationPreviewQuery(api: Client<paths>, token: string) {
  return queryOptions({
    queryKey: ["invitation", token] as const,
    queryFn: async () =>
      unwrap(await api.POST("/invitations/preview", { body: { token } })),
    retry: false,
  });
}

// POST /invitations/accept; the answer is 204.
export function useAcceptInvitation() {
  const api = useApi();
  return useMutation({
    mutationFn: async (input: AcceptInvitationInput) => {
      await unwrap(await api.POST("/invitations/accept", { body: input }));
    },
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

export type SecondFactorChallenge =
  components["schemas"]["SecondFactorChallenge"];
export type SecondFactorInput = components["schemas"]["SecondFactorInput"];

// POST /session: undefined on 204, the challenge on 202 (HA46).
export function useLogin() {
  const api = useApi();
  return useMutation({
    mutationFn: async (credentials: {
      email: string;
      password: string;
    }): Promise<SecondFactorChallenge | undefined> =>
      unwrap(await api.POST("/session", { body: credentials })),
  });
}

// POST /session/second-factor; the answer is 204.
export function useCompleteSecondFactor() {
  const api = useApi();
  return useMutation({
    mutationFn: async (input: SecondFactorInput) => {
      await unwrap(await api.POST("/session/second-factor", { body: input }));
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

// Stores the display name; an empty name clears it. The answer replaces the cached profile.
export function useSetDisplayName() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (displayName: string) =>
      unwrap(await api.PATCH("/me", { body: { display_name: displayName } })),
    onSuccess: (me) => {
      queryClient.setQueryData(meQuery(api).queryKey, me);
    },
  });
}

export const appearanceSaveKey = ["me", "appearance", "save"] as const;

export type AppearanceInput =
  paths["/me/appearance"]["put"]["requestBody"]["content"]["application/json"];

export function appearanceQuery(api: Client<paths>, memberID: number) {
  return queryOptions({
    queryKey: ["me", memberID, "appearance"] as const,
    queryFn: async () => unwrap(await api.GET("/me/appearance")),
  });
}

export function useSaveAppearance() {
  const api = useApi();
  return useMutation({
    mutationKey: appearanceSaveKey,
    mutationFn: async (input: AppearanceInput) =>
      unwrap(await api.PUT("/me/appearance", { body: input })),
  });
}
