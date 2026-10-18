import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { Client } from "openapi-fetch";

import { useApi } from "@/api/api-context";
import { unwrap } from "@/api/problem";
import type { components, paths } from "@/api/schema.gen";

export type Basis = "booked" | "settled";

export const accountKeys = {
  all: ["accounts"] as const,
  list: ["accounts", "list"] as const,
  detail: (id: string) => ["accounts", "detail", id] as const,
  balances: (id: string) => ["accounts", "balance", id] as const,
  balance: (id: string, basis: Basis) =>
    ["accounts", "balance", id, basis] as const,
  series: (id: string) => ["accounts", "series", id] as const,
};

export const balanceKeys = {
  all: ["balances"] as const,
  at: (date: string, basis: Basis) => ["balances", date, basis] as const,
};

const pageLimit = 200;

export function accountsQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: accountKeys.list,
    queryFn: async () => {
      const items: components["schemas"]["Account"][] = [];
      let cursor: string | undefined;
      do {
        const page = await unwrap(
          await api.GET("/accounts", {
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

// B2: each item is the balance of the account's own postings; a parent and its children are never added here.
export function balancesQuery(api: Client<paths>, date: string, basis: Basis) {
  return queryOptions({
    queryKey: balanceKeys.at(date, basis),
    queryFn: async () => {
      const list = await unwrap(
        await api.GET("/balances", { params: { query: { date, basis } } }),
      );
      return list.items;
    },
  });
}

// B2 does not apply here: the account balance sums the account and its descendants.
export function balanceQuery(
  api: Client<paths>,
  id: string,
  date: string,
  basis: Basis,
) {
  return queryOptions({
    queryKey: [...accountKeys.balance(id, basis), date] as const,
    queryFn: async () =>
      unwrap(
        await api.GET("/accounts/{id}/balance", {
          params: { path: { id }, query: { date, basis } },
        }),
      ),
  });
}

export function seriesQuery(
  api: Client<paths>,
  id: string,
  from: string,
  to: string,
) {
  return queryOptions({
    queryKey: [...accountKeys.series(id), from, to] as const,
    queryFn: async () =>
      unwrap(
        await api.GET("/reports/balances", {
          params: { query: { account_id: id, from, to } },
        }),
      ),
  });
}

type AccountInput = components["schemas"]["AccountInput"];
type AccountPatch = components["schemas"]["AccountPatch"];

function mutated(queryClient: QueryClient): Promise<unknown> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: accountKeys.all }),
    queryClient.invalidateQueries({ queryKey: balanceKeys.all }),
  ]);
}

export function useCreateAccount() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: AccountInput) =>
      unwrap(await api.POST("/accounts", { body })),
    onSuccess: () => mutated(queryClient),
  });
}

export function useUpdateAccount() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: AccountPatch }) =>
      unwrap(
        await api.PATCH("/accounts/{id}", {
          params: { path: { id } },
          body: patch,
        }),
      ),
    onSuccess: () => mutated(queryClient),
  });
}

export function useCloseAccount() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, closedOn }: { id: string; closedOn: string }) =>
      unwrap(
        await api.POST("/accounts/{id}/close", {
          params: { path: { id } },
          body: { closed_on: closedOn },
        }),
      ),
    onSuccess: () => mutated(queryClient),
  });
}
