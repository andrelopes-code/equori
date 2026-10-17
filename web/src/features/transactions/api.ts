import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import type { Client } from "openapi-fetch";

import { unwrap } from "@/api/problem";
import type { paths } from "@/api/schema.gen";

export interface TransactionSearch {
  account_id?: string;
  payee_id?: string;
  tag?: string;
  from?: string;
  to?: string;
  uncategorized?: boolean;
  q?: string;
  limit?: number;
}

export const transactionKeys = {
  all: ["transactions"] as const,
  list: (search: TransactionSearch) =>
    ["transactions", "list", search] as const,
  detail: (id: string) => ["transactions", "detail", id] as const,
  versions: (id: string) => ["transactions", "versions", id] as const,
};

const defaultLimit = 50;
const countLimit = 200;

export function transactionsInfiniteQuery(
  api: Client<paths>,
  search: TransactionSearch,
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
