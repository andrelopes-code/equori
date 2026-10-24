import { queryOptions, useMutation } from "@tanstack/react-query";
import type { Client } from "openapi-fetch";

import { useApi } from "@/api/api-context";
import { unwrap } from "@/api/problem";
import type { components, paths } from "@/api/schema.gen";

export const planningKeys = {
  all: ["planning"] as const,
  schedules: ["planning", "schedules"] as const,
  schedule: (id: string) => ["planning", "schedule", id] as const,
  occurrences: (from: string, to: string, filter: OccurrenceFilter) =>
    ["planning", "occurrences", from, to, filter] as const,
  transactions: (accountID: string, from: string, to: string) =>
    ["planning", "transactions", accountID, from, to] as const,
  projection: (accountID: string, to: string) =>
    ["planning", "projection", accountID, to] as const,
  budgets: ["planning", "budgets"] as const,
  progress: (budgetID: string, month: string) =>
    ["planning", "budget-progress", budgetID, month] as const,
  goals: ["planning", "goals"] as const,
};

type OccurrenceFilter = Pick<
  NonNullable<paths["/occurrences"]["get"]["parameters"]["query"]>,
  "schedule_id" | "state"
>;

const pageLimit = 200;

// A household holds few schedules, budgets and goals; each list follows its cursor to the end.
async function everyPage<T>(
  page: (cursor: string | undefined) => Promise<{
    items: T[];
    next_cursor?: string | undefined;
  }>,
): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;
  do {
    const next = await page(cursor);
    items.push(...next.items);
    // A cursor that does not move would page forever.
    cursor = next.next_cursor === cursor ? undefined : next.next_cursor;
  } while (cursor !== undefined);
  return items;
}

export function schedulesQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: planningKeys.schedules,
    queryFn: () =>
      everyPage(async (cursor) =>
        unwrap(
          await api.GET("/schedules", {
            params: {
              query: { limit: pageLimit, ...(cursor ? { cursor } : {}) },
            },
          }),
        ),
      ),
  });
}

export function scheduleQuery(api: Client<paths>, id: string) {
  return queryOptions({
    queryKey: planningKeys.schedule(id),
    queryFn: async () =>
      unwrap(await api.GET("/schedules/{id}", { params: { path: { id } } })),
    staleTime: 60_000,
  });
}

export function occurrencesQuery(
  api: Client<paths>,
  from: string,
  to: string,
  filter: OccurrenceFilter = {},
) {
  return queryOptions({
    queryKey: planningKeys.occurrences(from, to, filter),
    queryFn: async () => {
      const list = await unwrap(
        await api.GET("/occurrences", {
          params: { query: { from, to, ...filter } },
        }),
      );
      return list.items;
    },
  });
}

// The transactions of one account in a few days around an occurrence: the ones that can realize it.
export function accountTransactionsQuery(
  api: Client<paths>,
  accountID: string,
  from: string,
  to: string,
) {
  return queryOptions({
    queryKey: planningKeys.transactions(accountID, from, to),
    queryFn: () =>
      everyPage(async (cursor) =>
        unwrap(
          await api.GET("/transactions", {
            params: {
              query: {
                account_id: accountID,
                from,
                to,
                limit: pageLimit,
                ...(cursor ? { cursor } : {}),
              },
            },
          }),
        ),
      ),
  });
}

export function projectionQuery(
  api: Client<paths>,
  accountID: string,
  to: string,
) {
  return queryOptions({
    queryKey: planningKeys.projection(accountID, to),
    queryFn: async () =>
      unwrap(
        await api.GET("/accounts/{id}/projection", {
          params: { path: { id: accountID }, query: { to } },
        }),
      ),
  });
}

export function budgetsQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: planningKeys.budgets,
    queryFn: () =>
      everyPage(async (cursor) =>
        unwrap(
          await api.GET("/budgets", {
            params: {
              query: { limit: pageLimit, ...(cursor ? { cursor } : {}) },
            },
          }),
        ),
      ),
  });
}

export function budgetProgressQuery(
  api: Client<paths>,
  budgetID: string,
  month: string,
) {
  return queryOptions({
    queryKey: planningKeys.progress(budgetID, month),
    queryFn: async () =>
      unwrap(
        await api.GET("/budgets/{id}/progress", {
          params: { path: { id: budgetID }, query: { month } },
        }),
      ),
  });
}

export function goalsQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: planningKeys.goals,
    queryFn: () =>
      everyPage(async (cursor) =>
        unwrap(
          await api.GET("/goals", {
            params: {
              query: { limit: pageLimit, ...(cursor ? { cursor } : {}) },
            },
          }),
        ),
      ),
  });
}

export function useCreateGoal() {
  const api = useApi();
  return useMutation({
    mutationFn: async (goal: components["schemas"]["GoalInput"]) =>
      unwrap(await api.POST("/goals", { body: goal })),
  });
}

export function useUpdateGoal() {
  const api = useApi();
  return useMutation({
    mutationFn: async ({
      id,
      goal,
    }: {
      id: string;
      goal: components["schemas"]["GoalPatch"];
    }) =>
      unwrap(
        await api.PATCH("/goals/{id}", {
          params: { path: { id } },
          body: goal,
        }),
      ),
  });
}

export function useDeleteGoal() {
  const api = useApi();
  return useMutation({
    mutationFn: async (id: string) => {
      const result = await api.DELETE("/goals/{id}", {
        params: { path: { id } },
      });
      if (result.error !== undefined) await unwrap(result);
    },
  });
}

export function useRealizeOccurrence() {
  const api = useApi();
  return useMutation({
    mutationFn: async ({
      id,
      transactionID,
    }: {
      id: string;
      transactionID: string;
    }) =>
      unwrap(
        await api.POST("/occurrences/{id}/realize", {
          params: { path: { id } },
          body: { transaction_id: transactionID },
        }),
      ),
  });
}

export function useUnrealizeOccurrence() {
  const api = useApi();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(
        await api.POST("/occurrences/{id}/unrealize", {
          params: { path: { id } },
        }),
      ),
  });
}

export function useSkipOccurrence() {
  const api = useApi();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      unwrap(
        await api.POST("/occurrences/{id}/skip", {
          params: { path: { id } },
          body: reason === "" ? {} : { reason },
        }),
      ),
  });
}

export function useMoveOccurrence() {
  const api = useApi();
  return useMutation({
    mutationFn: async ({ id, date }: { id: string; date: string }) =>
      unwrap(
        await api.POST("/occurrences/{id}/move", {
          params: { path: { id } },
          body: { date },
        }),
      ),
  });
}
