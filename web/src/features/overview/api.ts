import { queryOptions } from "@tanstack/react-query";
import type { Client } from "openapi-fetch";

import { unwrap } from "@/api/problem";
import type { paths } from "@/api/schema.gen";

export function netWorthQuery(
  api: Client<paths>,
  date: string,
  valueIn: string,
) {
  return queryOptions({
    queryKey: ["reports", "net-worth", date, valueIn] as const,
    queryFn: async () =>
      unwrap(
        await api.GET("/reports/net-worth", {
          params: { query: { date, value_in: valueIn } },
        }),
      ),
  });
}

const uncategorizedPage = 200;

// One page is enough to say "many": a longer list reads as at least a page.
export function uncategorizedQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: ["transactions", "uncategorized-count"] as const,
    queryFn: async () => {
      const page = await unwrap(
        await api.GET("/transactions", {
          params: {
            query: { uncategorized: true, limit: uncategorizedPage },
          },
        }),
      );
      return {
        count: page.items.length,
        more: page.next_cursor !== undefined,
      };
    },
  });
}
