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
import type { paths } from "@/api/schema.gen";
import { accountKeys, balanceKeys } from "@/features/accounts";
import { payeesQuery } from "@/features/setup";
import type { TransactionSearch } from "@/features/transactions/search";
import { toTransactionInput } from "@/features/transactions/transaction-form-reducer";
import type { FormState } from "@/features/transactions/transaction-form-reducer";

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

// Every transaction mutation calls this: lists, balances and the touched accounts' detail and balance caches go stale together.
export function transactionMutated(
  queryClient: QueryClient,
  accountIds: string[],
): Promise<unknown> {
  const keys = [
    transactionKeys.all,
    balanceKeys.all,
    ...accountIds.flatMap((id) => [
      accountKeys.detail(id),
      ["accounts", "balance", id] as const,
    ]),
  ];
  return Promise.all(
    keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
}

export interface CreateTransactionRequest {
  state: FormState;
  currencyOf: (accountId: string) => string;
}

// A payee typed but not yet stored is created first, so the transaction carries its id.
export function useCreateTransaction() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ state, currencyOf }: CreateTransactionRequest) => {
      let payeeId = state.payeeId;
      if (payeeId === undefined && state.payeeName?.trim()) {
        const payee = await unwrap(
          await api.POST("/payees", { body: { name: state.payeeName.trim() } }),
        );
        payeeId = payee.id;
        await queryClient.invalidateQueries({
          queryKey: payeesQuery(api).queryKey,
        });
      }
      const input = toTransactionInput(
        { ...state, ...(payeeId === undefined ? {} : { payeeId }) },
        currencyOf,
      );
      return unwrap(await api.POST("/transactions", { body: input }));
    },
    onSuccess: (_created, { state, currencyOf }) =>
      transactionMutated(
        queryClient,
        toTransactionInput(state, currencyOf).postings.map((p) => p.account_id),
      ),
  });
}
