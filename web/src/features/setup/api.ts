import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { Client } from "openapi-fetch";

import { useApi } from "@/api/api-context";
import { unwrap } from "@/api/problem";
import type { components, paths } from "@/api/schema.gen";

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
