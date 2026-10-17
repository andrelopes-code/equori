import { queryOptions } from "@tanstack/react-query";
import type { Client } from "openapi-fetch";

import { unwrap } from "@/api/problem";
import type { components, paths } from "@/api/schema.gen";

export type Basis = "booked" | "settled";

export const accountKeys = {
  all: ["accounts"] as const,
  list: ["accounts", "list"] as const,
  detail: (id: string) => ["accounts", "detail", id] as const,
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
