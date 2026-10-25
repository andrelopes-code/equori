import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { Client } from "openapi-fetch";

import { useApi } from "@/api/api-context";
import { unwrap } from "@/api/problem";
import type { components, paths } from "@/api/schema.gen";
import { meQuery } from "@/features/session";
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

// Applies the region at once, so formats follow, and stores it in the profile.
export function useChooseRegion(): (region: string) => void {
  const api = useApi();
  const queryClient = useQueryClient();
  const { locale, setLocale } = useAppLocaleState();
  const update = useMutation({
    mutationFn: async (region: string) =>
      unwrap(await api.PATCH("/me", { body: { region } })),
    onSuccess: (me) => {
      queryClient.setQueryData(meQuery(api).queryKey, me);
    },
  });
  return (region) => {
    setLocale({ ...locale, region });
    update.mutate(region);
  };
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
