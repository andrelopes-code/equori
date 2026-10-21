import {
  infiniteQueryOptions,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { Client } from "openapi-fetch";

import { useApi } from "@/api/api-context";
import { unwrap } from "@/api/problem";
import type { components, paths } from "@/api/schema.gen";
import { accountKeys, balanceKeys } from "@/features/accounts";
import { setupKeys } from "@/features/setup";
import { bulkLimit, chunks } from "@/features/transactions/categorize";
import type { TransactionSearch } from "@/features/transactions/search";

export interface TransactionQuery extends TransactionSearch {
  limit?: number;
}

export const transactionKeys = {
  all: ["transactions"] as const,
  list: (search: TransactionQuery) => ["transactions", "list", search] as const,
  detail: (id: string) => ["transactions", "detail", id] as const,
  versions: (id: string) => ["transactions", "versions", id] as const,
};

const defaultLimit = 50;
const countLimit = 200;

export function transactionsInfiniteQuery(
  api: Client<paths>,
  search: TransactionQuery,
) {
  return infiniteQueryOptions({
    queryKey: transactionKeys.list(search),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      unwrap(
        await api.GET("/transactions", {
          params: {
            query: {
              ...search,
              limit: search.limit ?? defaultLimit,
              ...(pageParam === undefined ? {} : { cursor: pageParam }),
            },
          },
        }),
      ),
    getNextPageParam: (last) => last.next_cursor,
  });
}

// Every transaction of a period, following the cursor; a month of a household fits a few pages.
export function periodTransactionsQuery(
  api: Client<paths>,
  from: string,
  to: string,
) {
  return queryOptions({
    queryKey: [...transactionKeys.all, "period", from, to] as const,
    queryFn: async () => {
      const items: components["schemas"]["Transaction"][] = [];
      let cursor: string | undefined;
      do {
        const page = await unwrap(
          await api.GET("/transactions", {
            params: {
              query: { from, to, limit: 200, ...(cursor ? { cursor } : {}) },
            },
          }),
        );
        items.push(...page.items);
        // A cursor that does not move would page forever.
        cursor = page.next_cursor === cursor ? undefined : page.next_cursor;
      } while (cursor !== undefined);
      return items;
    },
  });
}

// No count endpoint exists: one page of 200 gives the count, and a next cursor means "more than 200".
export function uncategorizedCountQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: [...transactionKeys.all, "uncategorized-count"] as const,
    queryFn: async () => {
      const page = await unwrap(
        await api.GET("/transactions", {
          params: { query: { uncategorized: true, limit: countLimit } },
        }),
      );
      const more = page.next_cursor !== undefined;
      return { count: more ? countLimit : page.items.length, more };
    },
  });
}

// Every tag in use, following the cursor to the last page.
export function tagsQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: [...transactionKeys.all, "tags"] as const,
    queryFn: async () => {
      const tags: string[] = [];
      let cursor: string | undefined;
      do {
        const page = await unwrap(
          await api.GET("/tags", {
            params: {
              query: {
                limit: countLimit,
                ...(cursor === undefined ? {} : { cursor }),
              },
            },
          }),
        );
        tags.push(...page.items);
        cursor = page.next_cursor;
      } while (cursor !== undefined);
      return tags;
    },
  });
}

// Every transaction mutation calls this: lists, balances, every account cache (a parent balance sums its descendants) and the currency lock check go stale together.
export function transactionMutated(
  queryClient: QueryClient,
  accountIds: string[],
): Promise<unknown> {
  const keys = [
    transactionKeys.all,
    balanceKeys.all,
    accountKeys.all,
    setupKeys.hasTransactions,
    ...accountIds.flatMap((id) => [
      accountKeys.detail(id),
      accountKeys.balances(id),
      accountKeys.series(id),
    ]),
  ];
  return Promise.all(
    keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
}

type Transaction = components["schemas"]["Transaction"];

export function transactionQuery(api: Client<paths>, id: string) {
  return queryOptions({
    queryKey: transactionKeys.detail(id),
    queryFn: async () =>
      unwrap(await api.GET("/transactions/{id}", { params: { path: { id } } })),
  });
}

export function versionsQuery(api: Client<paths>, id: string) {
  return queryOptions({
    queryKey: transactionKeys.versions(id),
    queryFn: async () =>
      (
        await unwrap(
          await api.GET("/transactions/{id}/versions", {
            params: { path: { id } },
          }),
        )
      ).items,
  });
}

// The accounts of both versions go stale: a correction can move a posting off an account.
function mutated(
  queryClient: QueryClient,
  previous: Transaction,
  next: Transaction,
): Promise<unknown> {
  queryClient.setQueryData(transactionKeys.detail(previous.id), next);
  const ids = [...previous.postings, ...next.postings].map((p) => p.account_id);
  return transactionMutated(queryClient, [...new Set(ids)]);
}

export function useVoidTransaction() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      current,
      reason,
    }: {
      current: Transaction;
      reason: string;
    }) =>
      unwrap(
        await api.POST("/transactions/{id}/void", {
          params: { path: { id: current.id } },
          body: { reason },
        }),
      ),
    onSuccess: (next, { current }) => mutated(queryClient, current, next),
  });
}

export function useCategorizeTransaction() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      current,
      parts,
    }: {
      current: Transaction;
      parts: components["schemas"]["CategoryPart"][];
    }) =>
      unwrap(
        await api.POST("/transactions/{id}/categorize", {
          params: { path: { id: current.id } },
          body: { expected_version: current.version, parts },
        }),
      ),
    onSuccess: (next, { current }) => mutated(queryClient, current, next),
  });
}

type BulkItemResult = components["schemas"]["BulkCategorizeItemResult"];

// A78: each item is decided on its own; the request takes at most 200 items, so a larger
// selection is sent in runs and the answers are joined in order.
export function useBulkCategorize() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      categoryId,
      items,
    }: {
      categoryId: string;
      items: { id: string; expected_version: number }[];
    }) => {
      const results: BulkItemResult[] = [];
      for (const run of chunks(items, bulkLimit)) {
        const answer = await unwrap(
          await api.POST("/transactions/categorize", {
            body: { category_id: categoryId, items: run },
          }),
        );
        results.push(...answer.results);
      }
      return results;
    },
    onSuccess: (_results, { categoryId }) =>
      transactionMutated(queryClient, [categoryId]),
  });
}

// One page of up to 200 uncategorized transactions like the given one.
export async function similarTransactions(
  api: Client<paths>,
  search: TransactionSearch,
): Promise<Transaction[]> {
  const page = await unwrap(
    await api.GET("/transactions", {
      params: { query: { ...search, limit: countLimit } },
    }),
  );
  return page.items;
}
