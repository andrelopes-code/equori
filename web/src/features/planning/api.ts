import { queryOptions } from "@tanstack/react-query";
import type { Client } from "openapi-fetch";

import { unwrap } from "@/api/problem";
import type { paths } from "@/api/schema.gen";

export const planningKeys = {
  all: ["planning"] as const,
  schedules: ["planning", "schedules"] as const,
  occurrences: (from: string, to: string) =>
    ["planning", "occurrences", from, to] as const,
  projection: (accountID: string, to: string) =>
    ["planning", "projection", accountID, to] as const,
  budgets: ["planning", "budgets"] as const,
  progress: (budgetID: string, month: string) =>
    ["planning", "budget-progress", budgetID, month] as const,
  goals: ["planning", "goals"] as const,
};

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

export function occurrencesQuery(api: Client<paths>, from: string, to: string) {
  return queryOptions({
    queryKey: planningKeys.occurrences(from, to),
    queryFn: async () => {
      const list = await unwrap(
        await api.GET("/occurrences", { params: { query: { from, to } } }),
      );
      return list.items;
    },
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
