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
import { payeesQuery } from "@/features/setup";
import type { TransactionSearch } from "@/features/transactions/search";
import {
  toCorrectionInput,
  toTransactionInput,
} from "@/features/transactions/transaction-form-reducer";
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

// Every transaction mutation calls this: lists, balances and the touched accounts' detail, balance and series caches go stale together.
export function transactionMutated(
  queryClient: QueryClient,
  accountIds: string[],
): Promise<unknown> {
  const keys = [
    transactionKeys.all,
    balanceKeys.all,
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

// A payee typed but not yet stored is created first, so the transaction carries its id.
async function ensurePayee(
  api: Client<paths>,
  queryClient: QueryClient,
  state: FormState,
  onPayeeCreated: ((id: string) => void) | undefined,
): Promise<string | undefined> {
  if (state.payeeId !== undefined || !state.payeeName?.trim()) {
    return state.payeeId;
  }
  const payee = await unwrap(
    await api.POST("/payees", { body: { name: state.payeeName.trim() } }),
  );
  onPayeeCreated?.(payee.id);
  await queryClient.invalidateQueries({ queryKey: payeesQuery(api).queryKey });
  return payee.id;
}

export interface CreateTransactionRequest {
  state: FormState;
  currencyOf: (accountId: string) => string;
  // Called as soon as a typed payee is stored, so a retry reuses it instead of posting the name again.
  onPayeeCreated?: (id: string) => void;
}

// A payee typed but not yet stored is created first, so the transaction carries its id.
export function useCreateTransaction() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      state,
      currencyOf,
      onPayeeCreated,
    }: CreateTransactionRequest) => {
      const payeeId = await ensurePayee(
        api,
        queryClient,
        state,
        onPayeeCreated,
      );
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

export interface CorrectTransactionRequest extends CreateTransactionRequest {
  current: Transaction;
  reason: string;
}

// The request carries the version the user loaded; a stale one is answered with 409.
export function useCorrectTransaction() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      current,
      state,
      currencyOf,
      reason,
      onPayeeCreated,
    }: CorrectTransactionRequest) => {
      const payeeId = await ensurePayee(
        api,
        queryClient,
        state,
        onPayeeCreated,
      );
      const input = toCorrectionInput(
        { ...state, ...(payeeId === undefined ? {} : { payeeId }) },
        currencyOf,
        current.links,
      );
      return unwrap(
        await api.PUT("/transactions/{id}", {
          params: { path: { id: current.id } },
          body: { ...input, expected_version: current.version, reason },
        }),
      );
    },
    onSuccess: (next, { current }) => mutated(queryClient, current, next),
  });
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
