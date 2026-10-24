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
