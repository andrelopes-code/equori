import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { Client } from "openapi-fetch";

import { useApi } from "@/api/api-context";
import { unwrap } from "@/api/problem";
import type { components, paths } from "@/api/schema.gen";
import {
  createPasskeyCredential,
  meQuery,
  reloadHome,
} from "@/features/session";
import type { BooksMembership } from "@/features/session";
import { useAppLocaleState } from "@/i18n/i18n-provider";

export const setupKeys = {
  settings: ["setup", "settings"] as const,
  instruments: ["setup", "instruments"] as const,
  payees: ["setup", "payees"] as const,
  institutions: ["setup", "institutions"] as const,
  hasTransactions: ["setup", "has-transactions"] as const,
};

export function settingsQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: setupKeys.settings,
    queryFn: async () => unwrap(await api.GET("/settings")),
  });
}

// An instrument scale never changes, so the list is cached for the session.
export function instrumentsQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: setupKeys.instruments,
    queryFn: async () => unwrap(await api.GET("/instruments")),
    staleTime: Infinity,
  });
}

const pageLimit = 200;

// The picker and the row labels need every payee, so the query follows the cursor to the last page.
export function payeesQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: setupKeys.payees,
    queryFn: async () => {
      const items = [];
      let cursor: string | undefined;
      do {
        const page = await unwrap(
          await api.GET("/payees", {
            params: {
              query: {
                limit: pageLimit,
                ...(cursor === undefined ? {} : { cursor }),
              },
            },
          }),
        );
        items.push(...page.items);
        cursor = page.next_cursor;
      } while (cursor !== undefined);
      return items;
    },
  });
}

// The server rejects a base currency change once any transaction exists; one item answers whether one does.
export function hasTransactionsQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: setupKeys.hasTransactions,
    queryFn: async () => {
      const page = await unwrap(
        await api.GET("/transactions", { params: { query: { limit: 1 } } }),
      );
      return page.items.length > 0;
    },
  });
}

export function institutionsQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: setupKeys.institutions,
    queryFn: async () => {
      const items: components["schemas"]["Institution"][] = [];
      let cursor: string | undefined;
      do {
        const page = await unwrap(
          await api.GET("/institutions", {
            params: {
              query: {
                limit: pageLimit,
                ...(cursor === undefined ? {} : { cursor }),
              },
            },
          }),
        );
        items.push(...page.items);
        cursor = page.next_cursor;
      } while (cursor !== undefined);
      return items;
    },
  });
}

export function useUpdateSettings() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: components["schemas"]["Settings"]) =>
      unwrap(await api.PUT("/settings", { body })),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: setupKeys.settings }),
  });
}

export function useCreateInstitution() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: components["schemas"]["InstitutionInput"]) =>
      unwrap(await api.POST("/institutions", { body })),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: setupKeys.institutions }),
  });
}

export function useCreatePayee() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: components["schemas"]["PayeeInput"]) =>
      unwrap(await api.POST("/payees", { body })),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: setupKeys.payees }),
  });
}

export type BooksSettings = components["schemas"]["BooksSettings"];
export type BooksSettingsInput = components["schemas"]["BooksSettingsInput"];

export function booksQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: ["books", "current"] as const,
    queryFn: async () => unwrap(await api.GET("/books/current")),
  });
}

// Applies the region at once, so formats follow, and stores it with the book.
export function useUpdateBooks() {
  const api = useApi();
  const queryClient = useQueryClient();
  const { locale, setLocale } = useAppLocaleState();
  return useMutation({
    mutationFn: async (body: BooksSettingsInput) =>
      unwrap(await api.PATCH("/books/current", { body })),
    onMutate: (input) => {
      setLocale({ ...locale, region: input.region });
    },
    onSuccess: async (books) => {
      queryClient.setQueryData(booksQuery(api).queryKey, books);
      await queryClient.invalidateQueries({ queryKey: meQuery(api).queryKey });
    },
  });
}

export type CreateBooksInput = components["schemas"]["CreateBooksInput"];

export function useCreateBooks() {
  const api = useApi();
  return useMutation({
    mutationFn: async (body: CreateBooksInput): Promise<BooksMembership> =>
      unwrap(await api.POST("/books", { body })),
  });
}

export type BooksMember = components["schemas"]["BooksMember"];
export type BookRole = components["schemas"]["BookRole"];

export function membersQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: ["books", "members"] as const,
    queryFn: async () =>
      (await unwrap(await api.GET("/books/current/members"))).items,
  });
}

export function useUpdateMember() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { memberId: number; role: BookRole }) =>
      unwrap(
        await api.PATCH("/books/current/members/{memberId}", {
          params: { path: { memberId: input.memberId } },
          body: { role: input.role },
        }),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: membersQuery(api).queryKey }),
  });
}

export function useRemoveMember() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (memberId: number) =>
      unwrap(
        await api.DELETE("/books/current/members/{memberId}", {
          params: { path: { memberId } },
        }),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: membersQuery(api).queryKey }),
  });
}

export type Invitation = components["schemas"]["Invitation"];
export type InvitationInput = components["schemas"]["InvitationInput"];

export function invitationsQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: ["books", "invitations"] as const,
    queryFn: async () =>
      (await unwrap(await api.GET("/books/current/invitations"))).items,
  });
}

export function useCreateInvitation() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: InvitationInput): Promise<Invitation> =>
      unwrap(await api.POST("/books/current/invitations", { body })),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: invitationsQuery(api).queryKey,
      }),
  });
}

export type AccountInvitation = components["schemas"]["AccountInvitation"];
export type AccountInvitationInput =
  components["schemas"]["AccountInvitationInput"];

export function useCreateAccountInvitation() {
  const api = useApi();
  return useMutation({
    mutationFn: async (
      body: AccountInvitationInput,
    ): Promise<AccountInvitation> =>
      unwrap(await api.POST("/account-invitations", { body })),
  });
}

export function useDeleteInvitation() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await api.DELETE("/books/current/invitations/{id}", {
          params: { path: { id } },
        }),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: invitationsQuery(api).queryKey,
      }),
  });
}

// Leaving ends the session's book: the reload reads the account's next book (HA32).
export function useLeaveBooks() {
  const api = useApi();
  return useMutation({
    mutationFn: async () =>
      unwrap(await api.DELETE("/books/current/membership")),
    onSuccess: reloadHome,
  });
}

// Deleting ends the session's book like leaving: the reload reads the account's next book (DB6).
export function useDeleteBooks() {
  const api = useApi();
  return useMutation({
    mutationFn: async (name: string) =>
      unwrap(await api.DELETE("/books/current", { body: { name } })),
    onSuccess: reloadHome,
  });
}

export type SyncSchedule = components["schemas"]["SyncSchedule"];

export function syncScheduleQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: ["ingestion", "sync-schedule"] as const,
    queryFn: async () => unwrap(await api.GET("/ingestion/sync-schedule")),
  });
}

export function useSetSyncSchedule() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: SyncSchedule) =>
      unwrap(await api.PUT("/ingestion/sync-schedule", { body })),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: syncScheduleQuery(api).queryKey,
      }),
  });
}

export type ModelProvider = components["schemas"]["Provider"];
export type ModelPreset = components["schemas"]["Preset"];
export type ModelUse = components["schemas"]["Use"];
export type ChainTargetInput = components["schemas"]["ChainTargetInput"];
export type UsageRow = components["schemas"]["UsageRow"];
export type UsageDay = components["schemas"]["UsageDay"];

export const assistantKeys = {
  presets: ["assistant", "presets"] as const,
  providers: ["assistant", "providers"] as const,
  uses: ["assistant", "uses"] as const,
  usage: ["assistant", "usage"] as const,
  usageDays: (from: string, to: string) =>
    ["assistant", "usage", "days", from, to] as const,
  models: (id: string) => ["assistant", "providers", id, "models"] as const,
};

// Presets are fixed in the server's code, so the list is cached for the session.
export function presetsQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: assistantKeys.presets,
    queryFn: async () => unwrap(await api.GET("/assistant/presets")),
    staleTime: Infinity,
  });
}

export function providersQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: assistantKeys.providers,
    queryFn: async () => unwrap(await api.GET("/assistant/providers")),
  });
}

export function usesQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: assistantKeys.uses,
    queryFn: async () => unwrap(await api.GET("/assistant/uses")),
  });
}

// The listing calls the provider, so a failure is not retried: it is the answer the reader asked for.
export function providerModelsQuery(api: Client<paths>, id: string) {
  return queryOptions({
    queryKey: assistantKeys.models(id),
    queryFn: async () =>
      unwrap(
        await api.GET("/assistant/providers/{id}/models", {
          params: { path: { id } },
        }),
      ),
    retry: false,
  });
}

// Calls the provider with its stored key; a rejection arrives as the mutation's error.
export function useCheckProviderKey() {
  const api = useApi();
  return useMutation({
    mutationFn: async (id: string) =>
      (
        await unwrap(
          await api.GET("/assistant/providers/{id}/models", {
            params: { path: { id } },
          }),
        )
      ).items.length,
  });
}

export function useCreateProvider() {
  const api = useApi();
  return useMutation({
    mutationFn: async (body: components["schemas"]["ProviderInput"]) =>
      unwrap(await api.POST("/assistant/providers", { body })),
  });
}

export function useUpdateProvider() {
  const api = useApi();
  return useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: string;
      body: components["schemas"]["ProviderPatch"];
    }) =>
      unwrap(
        await api.PATCH("/assistant/providers/{id}", {
          params: { path: { id } },
          body,
        }),
      ),
  });
}

export function useDeleteProvider() {
  const api = useApi();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await api.DELETE("/assistant/providers/{id}", {
          params: { path: { id } },
        }),
      ),
  });
}

export function useSetUseChain() {
  const api = useApi();
  return useMutation({
    mutationFn: async ({
      use,
      targets,
    }: {
      use: string;
      targets: ChainTargetInput[];
    }) =>
      unwrap(
        await api.PUT("/assistant/uses/{use}/chain", {
          params: { path: { use } },
          body: { targets },
        }),
      ),
  });
}

export function usageQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: assistantKeys.usage,
    queryFn: async () => unwrap(await api.GET("/assistant/usage")),
  });
}

export function usageDaysQuery(api: Client<paths>, from: string, to: string) {
  return queryOptions({
    queryKey: assistantKeys.usageDays(from, to),
    queryFn: async () =>
      (
        await unwrap(
          await api.GET("/assistant/usage/days", {
            params: { query: { from, to } },
          }),
        )
      ).items,
  });
}

export function useSetUsageLimit() {
  const api = useApi();
  return useMutation({
    mutationFn: async (body: components["schemas"]["UsageLimitInput"]) =>
      unwrap(await api.PUT("/assistant/usage/limits", { body })),
  });
}

export type Aggregator = components["schemas"]["Aggregator"];
export type Integration = components["schemas"]["Integration"];
export type Connection = components["schemas"]["Connection"];

export const integrationKeys = {
  aggregators: ["integrations", "aggregators"] as const,
  list: ["integrations", "list"] as const,
};

// The aggregators are fixed in the server's code, so the list is cached for the session.
export function aggregatorsQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: integrationKeys.aggregators,
    queryFn: async () => (await unwrap(await api.GET("/aggregators"))).items,
    staleTime: Infinity,
  });
}

// One page holds every integration of a household.
export function integrationsQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: integrationKeys.list,
    queryFn: async () =>
      (
        await unwrap(
          await api.GET("/integrations", { params: { query: { limit: 100 } } }),
        )
      ).items,
  });
}

// The same request and key as connectionsQuery of `connections`, which imports `accounts`,
// which imports this feature: reading it here keeps the imports one way and shares one cache entry.
export function integrationConnectionsQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: ["connections", "list"] as const,
    queryFn: async () =>
      unwrap(
        await api.GET("/connections", { params: { query: { limit: 100 } } }),
      ),
  });
}

export function useCreateIntegration() {
  const api = useApi();
  return useMutation({
    mutationFn: async (body: components["schemas"]["IntegrationInput"]) =>
      unwrap(await api.POST("/integrations", { body })),
  });
}

export function useUpdateIntegrationCredentials() {
  const api = useApi();
  return useMutation({
    mutationFn: async ({
      id,
      credentials,
    }: {
      id: string;
      credentials: Record<string, string>;
    }) =>
      unwrap(
        await api.PUT("/integrations/{id}/credentials", {
          params: { path: { id } },
          body: credentials,
        }),
      ),
  });
}

export function useDeleteIntegration() {
  const api = useApi();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await api.DELETE("/integrations/{id}", { params: { path: { id } } }),
      ),
  });
}

export const exportKeys = {
  current: ["setup", "export"] as const,
};

// The user's export, or null when none was requested; a pending one is read again until it ends.
export function exportQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: exportKeys.current,
    queryFn: async () => {
      const answer = await api.GET("/exports/current");
      if (answer.response.status === 404) return null;
      return unwrap(answer);
    },
    refetchInterval: (query) =>
      query.state.data?.status === "pending" ? 2000 : false,
  });
}

export const exportContentURL = "/api/v1/exports/current/content";

// A passphrase adds the integration credentials to the archive, sealed by it (export design C1).
export function useRequestExport() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (passphrase?: string) =>
      unwrap(
        await api.POST(
          "/exports",
          passphrase === undefined
            ? {}
            : { body: { credentials_passphrase: passphrase } },
        ),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: exportKeys.current }),
  });
}

export interface ImportArchiveInput {
  file: File;
  // Opens the credentials of an archive exported with them (export design C5).
  passphrase: string;
  // Imports an archive that carries credentials without them.
  skipCredentials: boolean;
}

export function useImportArchive() {
  const api = useApi();
  return useMutation({
    mutationFn: async ({
      file,
      passphrase,
      skipCredentials,
    }: ImportArchiveInput) => {
      const body = new FormData();
      // The server reads a part named passphrase before or after the file.
      if (passphrase !== "") body.append("passphrase", passphrase);
      if (skipCredentials) body.append("skip_credentials", "true");
      body.append("file", file);
      return unwrap(
        await api.POST("/imports/archive", {
          // openapi-fetch sends FormData as it is, with the boundary the browser writes.
          body: body as unknown as { file: string },
          bodySerializer: (value) => value as unknown as FormData,
        }),
      );
    },
  });
}

export type AccessToken = components["schemas"]["AccessToken"];

export const accessTokenKeys = {
  list: ["access-tokens"] as const,
};

export function accessTokensQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: accessTokenKeys.list,
    queryFn: async () => (await unwrap(await api.GET("/access-tokens"))).items,
  });
}

export function useCreateAccessToken() {
  const api = useApi();
  return useMutation({
    mutationFn: async (body: components["schemas"]["AccessTokenInput"]) =>
      unwrap(await api.POST("/access-tokens", { body })),
  });
}

export function useDeleteAccessToken() {
  const api = useApi();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await api.DELETE("/access-tokens/{id}", { params: { path: { id } } }),
      ),
  });
}

const marketDataKeys = {
  feeds: ["setup", "market-data-feeds"] as const,
};

type MarketDataFeed = components["schemas"]["MarketDataFeed"];

// ADR 025 F5. runsBefore holds the last_run of each enabled feed when an update was requested;
// the list is read every 5 seconds until each of them ran again.
export function marketDataFeedsQuery(
  api: Client<paths>,
  runsBefore: ReadonlyMap<string, string | null> | null = null,
) {
  return queryOptions({
    queryKey: marketDataKeys.feeds,
    queryFn: async () =>
      (await unwrap(await api.GET("/market-data/feeds"))).items,
    refetchInterval: (query) =>
      runsBefore !== null &&
      (query.state.data ?? []).some(
        (f: MarketDataFeed) =>
          runsBefore.has(f.id) && runsBefore.get(f.id) === f.last_run,
      )
        ? 5_000
        : false,
  });
}

export function useSetMarketDataFeed() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) =>
      unwrap(
        await api.PUT("/market-data/feeds/{id}", {
          params: { path: { id } },
          body: { enabled },
        }),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: marketDataKeys.feeds }),
  });
}

export function useRefreshMarketData() {
  const api = useApi();
  return useMutation({
    mutationFn: async () => unwrap(await api.POST("/market-data/refresh")),
  });
}

export type SecondFactor = components["schemas"]["SecondFactor"];
export type Passkey = components["schemas"]["Passkey"];
export type TotpSetup = components["schemas"]["TotpSetup"];

const secondFactorKey = ["me", "second-factor"] as const;

export function secondFactorQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: secondFactorKey,
    queryFn: async () => unwrap(await api.GET("/me/second-factor")),
  });
}

// POST /me/totp
export function useStartTotp() {
  const api = useApi();
  return useMutation({
    mutationFn: async () => unwrap(await api.POST("/me/totp")),
  });
}

// POST /me/totp/confirm; the answer holds the recovery codes of a first factor.
export function useConfirmTotp() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) =>
      (await unwrap(await api.POST("/me/totp/confirm", { body: { code } })))
        .recovery_codes,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: secondFactorKey }),
  });
}

// POST /me/totp/disable
export function useDisableTotp() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (password: string) => {
      await unwrap(await api.POST("/me/totp/disable", { body: { password } }));
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: secondFactorKey }),
  });
}

// POST /me/passkeys/options, the browser ceremony, then POST /me/passkeys.
export function useAddPasskey() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const options = await unwrap(await api.POST("/me/passkeys/options"));
      const credential = await createPasskeyCredential(options);

      return unwrap(
        await api.POST("/me/passkeys", { body: { name, ...credential } }),
      );
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: secondFactorKey }),
  });
}

// POST /me/passkeys/{id}/remove
export function useRemovePasskey() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => {
      await unwrap(
        await api.POST("/me/passkeys/{id}/remove", {
          params: { path: { id } },
          body: { password },
        }),
      );
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: secondFactorKey }),
  });
}

// POST /me/recovery-codes
export function useRegenerateRecoveryCodes() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (password: string) =>
      (
        await unwrap(
          await api.POST("/me/recovery-codes", { body: { password } }),
        )
      ).recovery_codes,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: secondFactorKey }),
  });
}
