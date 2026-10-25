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

type Account = components["schemas"]["Account"];
type Money = components["schemas"]["Money"];
type CsvProfile = components["schemas"]["CsvProfile"];
type ImportBatch = components["schemas"]["ImportBatch"];
type RecordState = components["schemas"]["ExternalRecord"]["state"];

export const importKeys = {
  all: ["imports"] as const,
  ofAccount: (id: string) => ["imports", "account", id] as const,
  batch: (id: string) => ["imports", "batch", id] as const,
  records: (id: string, state: RecordState | undefined) =>
    ["imports", "batch", id, "records", state ?? "all"] as const,
  profile: (id: string) => ["imports", "profile", id] as const,
};

export function accountQuery(api: Client<paths>, id: string) {
  return queryOptions({
    queryKey: accountKeys.detail(id),
    queryFn: async () =>
      unwrap(await api.GET("/accounts/{id}", { params: { path: { id } } })),
  });
}

export function reconciliationQuery(api: Client<paths>, id: string) {
  return queryOptions({
    queryKey: [...accountKeys.detail(id), "reconciliation"] as const,
    queryFn: async () =>
      unwrap(
        await api.GET("/accounts/{id}/reconciliation", {
          params: { path: { id } },
        }),
      ),
  });
}

export function assertionsQuery(api: Client<paths>, id: string) {
  return infiniteQueryOptions({
    queryKey: [...accountKeys.detail(id), "assertions"] as const,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      unwrap(
        await api.GET("/accounts/{id}/balance-assertions", {
          params: {
            path: { id },
            query: {
              limit: 20,
              ...(pageParam === undefined ? {} : { cursor: pageParam }),
            },
          },
        }),
      ),
    getNextPageParam: (last) => last.next_cursor,
  });
}

export function unconfirmedQuery(api: Client<paths>, id: string) {
  return queryOptions({
    queryKey: [...accountKeys.detail(id), "unconfirmed"] as const,
    queryFn: async () =>
      (
        await unwrap(
          await api.GET("/accounts/{id}/unconfirmed", {
            params: { path: { id } },
          }),
        )
      ).items,
  });
}

export function projectionQuery(api: Client<paths>, id: string, to: string) {
  return queryOptions({
    queryKey: [...accountKeys.detail(id), "projection", to] as const,
    queryFn: async () =>
      unwrap(
        await api.GET("/accounts/{id}/projection", {
          params: { path: { id }, query: { to } },
        }),
      ),
  });
}

export function positionsQuery(
  api: Client<paths>,
  date: string,
  valueIn?: string,
) {
  return queryOptions({
    queryKey: ["positions", date, valueIn] as const,
    queryFn: async () =>
      (
        await unwrap(
          await api.GET("/positions", {
            params: {
              query: {
                date,
                ...(valueIn === undefined ? {} : { value_in: valueIn }),
              },
            },
          }),
        )
      ).items,
  });
}

// An account without a profile answers 404: the import page then asks for one.
export function csvProfileQuery(api: Client<paths>, id: string) {
  return queryOptions({
    queryKey: importKeys.profile(id),
    queryFn: async (): Promise<CsvProfile | null> => {
      const result = await api.GET("/accounts/{id}/csv-profile", {
        params: { path: { id } },
      });
      if (result.response.status === 404) return null;
      return unwrap(result);
    },
  });
}

const accountBatchesWanted = 50;

// /import-batches lists every account's batches, newest first; the pages are read until the
// account has enough of its own or the list ends.
export function importBatchesQuery(api: Client<paths>, accountId: string) {
  return queryOptions({
    queryKey: importKeys.ofAccount(accountId),
    queryFn: async () => {
      const items: ImportBatch[] = [];
      let cursor: string | undefined;
      do {
        const page = await unwrap(
          await api.GET("/import-batches", {
            params: {
              query: {
                limit: pageLimit,
                ...(cursor === undefined ? {} : { cursor }),
              },
            },
          }),
        );
        items.push(...page.items.filter((b) => b.account_id === accountId));
        cursor = page.next_cursor;
      } while (cursor !== undefined && items.length < accountBatchesWanted);
      return items;
    },
  });
}

export function importBatchQuery(api: Client<paths>, id: string) {
  return queryOptions({
    queryKey: importKeys.batch(id),
    queryFn: async () =>
      unwrap(
        await api.GET("/import-batches/{id}", { params: { path: { id } } }),
      ),
  });
}

export function batchRecordsQuery(
  api: Client<paths>,
  id: string,
  state: RecordState | undefined,
) {
  return infiniteQueryOptions({
    queryKey: importKeys.records(id, state),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      unwrap(
        await api.GET("/import-batches/{id}/records", {
          params: {
            path: { id },
            query: {
              limit: 100,
              ...(state === undefined ? {} : { state }),
              ...(pageParam === undefined ? {} : { cursor: pageParam }),
            },
          },
        }),
      ),
    getNextPageParam: (last) => last.next_cursor,
  });
}

export function accountTransactionsQuery(
  api: Client<paths>,
  id: string,
  from: string,
  to: string,
) {
  return infiniteQueryOptions({
    queryKey: ["transactions", "list", { account_id: id, from, to }] as const,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      unwrap(
        await api.GET("/transactions", {
          params: {
            query: {
              account_id: id,
              from,
              to,
              // A page small enough to draw in one frame; older movements load on request.
              limit: 50,
              ...(pageParam === undefined ? {} : { cursor: pageParam }),
            },
          },
        }),
      ),
    getNextPageParam: (last) => last.next_cursor,
  });
}

export function transactionSummaryQuery(api: Client<paths>, id: string) {
  return queryOptions({
    queryKey: ["transactions", "detail", id] as const,
    queryFn: async () =>
      unwrap(await api.GET("/transactions/{id}", { params: { path: { id } } })),
  });
}

function useApiMutation<V, R>(fn: (api: Client<paths>, vars: V) => Promise<R>) {
  const api = useApi();
  return useMutation({ mutationFn: (vars: V) => fn(api, vars) });
}

export function useReopenAccount() {
  return useApiMutation(async (api, id: string) =>
    unwrap(
      await api.POST("/accounts/{id}/reopen", { params: { path: { id } } }),
    ),
  );
}

export function useSetParent() {
  return useApiMutation(
    async (api, { id, parentId }: { id: string; parentId: string | null }) =>
      unwrap(
        await api.PUT("/accounts/{id}/parent", {
          params: { path: { id } },
          body: { parent_id: parentId },
        }),
      ),
  );
}

export function useSetAppearance() {
  return useApiMutation(
    async (api, { id, color }: { id: string; color: number | null }) =>
      unwrap(
        await api.PUT("/accounts/{id}/appearance", {
          params: { path: { id } },
          body: { color, icon: null },
        }),
      ),
  );
}

// The schemes are fixed in the server's code, so the list is cached for the session.
export function identifierSchemesQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: ["institutions", "identifier-schemes"] as const,
    queryFn: async () =>
      (await unwrap(await api.GET("/institution-identifier-schemes"))).items,
    staleTime: Infinity,
  });
}

export function useSetInstitutionIdentifier() {
  return useApiMutation(
    async (
      api,
      {
        id,
        identifier,
      }: {
        id: string;
        identifier: { scheme: string; identifier: string } | null;
      },
    ) =>
      unwrap(
        await api.PUT("/institutions/{id}/identifier", {
          params: { path: { id } },
          body: identifier ?? { scheme: null, identifier: null },
        }),
      ),
  );
}

export function useCreateAssertion() {
  return useApiMutation(
    async (
      api,
      { id, date, amount }: { id: string; date: string; amount: Money },
    ) =>
      unwrap(
        await api.POST("/accounts/{id}/balance-assertions", {
          params: { path: { id } },
          body: { date, amount, source: "manual" },
        }),
      ),
  );
}

export function useResolveAssertion() {
  return useApiMutation(
    async (
      api,
      {
        id,
        resolution,
      }: {
        id: string;
        resolution: "adjustment" | "yield" | "transactions_added";
      },
    ) =>
      unwrap(
        await api.POST("/balance-assertions/{id}/resolve", {
          params: { path: { id } },
          body: { resolution },
        }),
      ),
  );
}

export function useUnlockAccount() {
  return useApiMutation(
    async (api, { id, from }: { id: string; from: string }) =>
      unwrap(
        await api.POST("/accounts/{id}/unlock", {
          params: { path: { id } },
          body: { from },
        }),
      ),
  );
}

export function useSaveCsvProfile() {
  return useApiMutation(
    async (api, { id, profile }: { id: string; profile: CsvProfile }) =>
      unwrap(
        await api.PUT("/accounts/{id}/csv-profile", {
          params: { path: { id } },
          body: profile,
        }),
      ),
  );
}

export async function importFile(
  api: Client<paths>,
  {
    accountId,
    format,
    file,
  }: { accountId: string; format: "ofx" | "csv"; file: File },
): Promise<ImportBatch> {
  const body = new FormData();
  body.append("format", format);
  body.append("file", file);
  return unwrap(
    await api.POST("/accounts/{id}/imports", {
      params: { path: { id: accountId } },
      // openapi-fetch sends FormData as it is, with the boundary the browser writes.
      body: body as unknown as { format: "ofx" | "csv"; file: string },
      bodySerializer: (value) => value as unknown as FormData,
    }),
  );
}

export function useImportFile() {
  return useApiMutation(importFile);
}

export function useResolveRecord() {
  return useApiMutation(
    async (
      api,
      {
        id,
        resolution,
      }: {
        id: string;
        resolution: components["schemas"]["RecordResolution"];
      },
    ) =>
      unwrap(
        await api.POST("/external-records/{id}/resolve", {
          params: { path: { id } },
          body: resolution,
        }),
      ),
  );
}

export function useMapExternalAccount() {
  return useApiMutation(
    async (
      api,
      {
        connectionId,
        externalId,
        mapping,
      }: {
        connectionId: string;
        externalId: string;
        mapping: components["schemas"]["AccountMappingInput"];
      },
    ) =>
      unwrap(
        await api.PUT("/connections/{id}/accounts/{external_account_id}", {
          params: {
            path: { id: connectionId, external_account_id: externalId },
          },
          body: mapping,
        }),
      ),
  );
}

export function useSyncConnection() {
  return useApiMutation(async (api, id: string) =>
    unwrap(
      await api.POST("/connections/{id}/sync", { params: { path: { id } } }),
    ),
  );
}

// S23: the opening balance is one transaction against the system account Opening balances.
export function openingBalanceBody(
  account: Pick<Account, "id" | "currency">,
  openingBalancesId: string,
  amount: number,
  date: string,
  statement?: string,
): components["schemas"]["TransactionInput"] {
  return {
    date,
    postings: [
      {
        account_id: account.id,
        amount: { amount, currency: account.currency },
        ...(statement === undefined ? {} : { statement }),
      },
      {
        account_id: openingBalancesId,
        amount: { amount: -amount, currency: account.currency },
      },
    ],
  };
}

export function useCreateTransaction() {
  return useApiMutation(
    async (api, body: components["schemas"]["TransactionInput"]) =>
      unwrap(await api.POST("/transactions", { body })),
  );
}

// The same request and key as connectionsQuery of `connections`, which imports this feature:
// reading it here keeps the import one way, and both share one cache entry.
export function connectionsListQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: ["connections", "list"] as const,
    queryFn: async () =>
      unwrap(
        await api.GET("/connections", { params: { query: { limit: 100 } } }),
      ),
  });
}

export function goalsQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: ["goals", "list"] as const,
    queryFn: async () =>
      (
        await unwrap(
          await api.GET("/goals", { params: { query: { limit: 100 } } }),
        )
      ).items,
  });
}
