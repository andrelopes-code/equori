import {
  infiniteQueryOptions,
  keepPreviousData,
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { Client } from "openapi-fetch";

import { useApi } from "@/api/api-context";
import { ProblemError, unwrap } from "@/api/problem";
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

// Every transaction a search keeps, following the cursor; the page asks only for a bounded period.
export function searchTransactionsQuery(
  api: Client<paths>,
  search: TransactionSearch,
) {
  return queryOptions({
    queryKey: [...transactionKeys.all, "search", search] as const,
    queryFn: async () => {
      const items: components["schemas"]["Transaction"][] = [];
      let cursor: string | undefined;
      do {
        const page = await unwrap(
          await api.GET("/transactions", {
            params: {
              query: { ...search, limit: 200, ...(cursor ? { cursor } : {}) },
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

export function categorizationQuery(api: Client<paths>, id: string) {
  return queryOptions({
    queryKey: [...transactionKeys.detail(id), "categorization"] as const,
    queryFn: async () =>
      unwrap(
        await api.GET("/transactions/{id}/categorization", {
          params: { path: { id } },
        }),
      ),
  });
}

// The rule that decided a categorization; a deleted rule answers 404 and the line says so.
export function ruleNameQuery(api: Client<paths>, id: string) {
  return queryOptions({
    queryKey: ["rules", "detail", id] as const,
    queryFn: async () =>
      (await unwrap(await api.GET("/rules/{id}", { params: { path: { id } } })))
        .name,
    retry: false,
  });
}

export function attachmentsQuery(api: Client<paths>, id: string) {
  return queryOptions({
    queryKey: [...transactionKeys.detail(id), "attachments"] as const,
    queryFn: async () =>
      (
        await unwrap(
          await api.GET("/transactions/{id}/attachments", {
            params: { path: { id } },
          }),
        )
      ).items,
  });
}

export function useUploadAttachment(transactionId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append("file", file);
      return unwrap(
        await api.POST("/transactions/{id}/attachments", {
          params: { path: { id: transactionId } },
          // openapi-fetch sends FormData as it is, with the boundary the browser writes.
          body: body as unknown as { file: string },
          bodySerializer: (value) => value as unknown as FormData,
        }),
      );
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: attachmentsQuery(api, transactionId).queryKey,
      }),
  });
}

export function useRemoveAttachment(transactionId: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await api.DELETE("/attachments/{id}", { params: { path: { id } } }),
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: attachmentsQuery(api, transactionId).queryKey,
      }),
  });
}

export function useTransferTransaction() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      current,
      accountId,
    }: {
      current: Transaction;
      accountId: string;
    }) =>
      unwrap(
        await api.POST("/transactions/{id}/transfer", {
          params: { path: { id: current.id } },
          body: { expected_version: current.version, account_id: accountId },
        }),
      ),
    onSuccess: (result, { current }) =>
      mutated(queryClient, current, result.transaction),
  });
}

export function reimbursementCandidatesQuery(api: Client<paths>, id: string) {
  return queryOptions({
    queryKey: [...transactionKeys.all, "reimbursement-candidates", id] as const,
    queryFn: async () =>
      unwrap(
        await api.GET("/transactions/{id}/reimbursement-candidates", {
          params: { path: { id } },
        }),
      ),
  });
}

export function reimbursementSourcesQuery(api: Client<paths>, id: string) {
  return queryOptions({
    queryKey: [...transactionKeys.all, "reimbursement-sources", id] as const,
    queryFn: async () =>
      unwrap(
        await api.GET("/transactions/{id}/reimbursement-sources", {
          params: { path: { id } },
        }),
      ),
  });
}

export type ReimbursementAllocation =
  components["schemas"]["ReimbursementAllocation"];

export function useReimburseTransaction() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      current,
      allocations,
    }: {
      current: Transaction;
      allocations: ReimbursementAllocation[];
    }) =>
      unwrap(
        await api.POST("/transactions/{id}/reimbursement", {
          params: { path: { id: current.id } },
          body: { expected_version: current.version, allocations },
        }),
      ),
    onSuccess: (result, { current }) => mutated(queryClient, current, result),
  });
}

export function useRecordTrade() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: components["schemas"]["TradeInput"]) =>
      unwrap(await api.POST("/trades", { body })),
    onSuccess: (created) =>
      transactionMutated(
        queryClient,
        created.postings.map((p) => p.account_id),
      ),
  });
}

export function useRecordInvestmentIncome() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: components["schemas"]["InvestmentIncomeInput"]) =>
      unwrap(await api.POST("/investment-income", { body })),
    onSuccess: (created) =>
      transactionMutated(
        queryClient,
        created.postings.map((p) => p.account_id),
      ),
  });
}

export function useRecordForeignPurchase() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: components["schemas"]["ForeignPurchaseInput"]) =>
      unwrap(await api.POST("/foreign-purchases", { body })),
    onSuccess: (created) =>
      transactionMutated(
        queryClient,
        created.postings.map((p) => p.account_id),
      ),
  });
}

export function useExchangeCurrency() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: components["schemas"]["ExchangeInput"]) =>
      unwrap(await api.POST("/exchanges", { body })),
    onSuccess: (created) =>
      transactionMutated(
        queryClient,
        created.postings.map((p) => p.account_id),
      ),
  });
}

// The types the user's jurisdiction accepts; the list changes only with the jurisdiction.
export function incomeTypesQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: ["income-types"] as const,
    queryFn: async () =>
      (await unwrap(await api.GET("/investment-income-types"))).items,
    staleTime: Infinity,
  });
}

export function useCreateTransaction() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: components["schemas"]["TransactionInput"]) =>
      unwrap(await api.POST("/transactions", { body })),
    onSuccess: (created) =>
      transactionMutated(
        queryClient,
        created.postings.map((p) => p.account_id),
      ),
  });
}

// The text read as drafts (A106). It records nothing, so it is a query keyed by what it
// reads; the drafts on screen stay while the next answer is on its way (AF-02).
export function capturePreviewQuery(
  api: Client<paths>,
  text: string,
  defaultAccountId: string | null,
) {
  return queryOptions({
    queryKey: [
      ...transactionKeys.all,
      "capture",
      text,
      defaultAccountId,
    ] as const,
    queryFn: async () =>
      unwrap(
        await api.POST("/capture/preview", {
          body: {
            text,
            ...(defaultAccountId === null
              ? {}
              : { default_account_id: defaultAccountId }),
          },
        }),
      ),
    enabled: text.trim() !== "",
    placeholderData: keepPreviousData,
  });
}

// Categories a language model names for drafts classification left without one (ADR 014).
// The server keeps every answer, so the query never goes stale on its own.
export function captureSuggestionsQuery(
  api: Client<paths>,
  items: components["schemas"]["CaptureSuggestionItem"][],
) {
  return queryOptions({
    queryKey: ["capture-suggestions", items] as const,
    // Each answer travels with the item it answers, so a previous answer shown while the next
    // is on its way never lands on another description.
    queryFn: async () => {
      const answer = await unwrap(
        await api.POST("/capture/suggestions", { body: { items } }),
      );
      return items.map((item, i) => ({
        ...item,
        categoryId: answer.items[i]?.category_id ?? null,
      }));
    },
    enabled: items.length > 0,
    staleTime: Infinity,
    placeholderData: keepPreviousData,
  });
}

// Records every entry or none (A114).
export function useRecordBatch() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      entries: components["schemas"]["TransactionBatchEntry"][],
    ) => unwrap(await api.POST("/transaction-batches", { body: { entries } })),
    onSuccess: (batch) =>
      transactionMutated(
        queryClient,
        batch.items.flatMap((t) => t.postings.map((p) => p.account_id)),
      ),
  });
}

export function useCorrectTransaction() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      current,
      body,
    }: {
      current: Transaction;
      body: components["schemas"]["CorrectionInput"];
    }) =>
      unwrap(
        await api.PUT("/transactions/{id}", {
          params: { path: { id: current.id } },
          body,
        }),
      ),
    onSuccess: (next, { current }) => mutated(queryClient, current, next),
  });
}

// The statement a card purchase on date would be billed on; null when the card has no billing
// rule for it, which leaves the entry without that consequence.
export function statementPlacementQuery(
  api: Client<paths>,
  cardId: string,
  date: string,
) {
  return queryOptions({
    queryKey: [...accountKeys.detail(cardId), "placement", date] as const,
    queryFn: async () => {
      try {
        return await unwrap(
          await api.GET("/accounts/{id}/statement-placement", {
            params: { path: { id: cardId }, query: { date } },
          }),
        );
      } catch (error) {
        if (error instanceof ProblemError && error.status === 422) return null;
        throw error;
      }
    },
  });
}

// The latest transactions of a category or of a payee, for the account suggestion.
export function recentTransactionsQuery(
  api: Client<paths>,
  filter: { account_id: string } | { payee_id: string },
  limit: number,
) {
  return queryOptions({
    queryKey: [...transactionKeys.all, "recent", filter, limit] as const,
    queryFn: async () =>
      (
        await unwrap(
          await api.GET("/transactions", {
            params: { query: { ...filter, limit } },
          }),
        )
      ).items,
  });
}

// Categories a language model names for recorded uncategorized transactions (ADR 014 L1a).
// Nothing is recorded, so the query is read once per selection.
export function transactionSuggestionsQuery(
  api: Client<paths>,
  ids: readonly string[],
) {
  return queryOptions({
    queryKey: ["transaction-suggestions", ids] as const,
    queryFn: async () =>
      unwrap(
        await api.POST("/transactions/category-suggestions", {
          body: { transaction_ids: [...ids] },
        }),
      ),
    enabled: ids.length > 0,
    staleTime: Infinity,
  });
}
