import { queryOptions } from "@tanstack/react-query";
import type { Client } from "openapi-fetch";

import { unwrap } from "@/api/problem";
import type { paths } from "@/api/schema.gen";

// The card amounts of one category in the cash view, each naming its statement and payment (N20).
export function cashPaymentsQuery(
  api: Client<paths>,
  categoryId: string,
  from: string,
  to: string,
) {
  return queryOptions({
    queryKey: ["reports", "cash-payments", categoryId, from, to] as const,
    queryFn: async () =>
      (
        await unwrap(
          await api.GET("/reports/categories/{id}/cash-payments", {
            params: { path: { id: categoryId }, query: { from, to } },
          }),
        )
      ).items,
  });
}

// Net worth at the end of each day of [from, to] (net worth days design, D1).
export function netWorthDaysQuery(
  api: Client<paths>,
  from: string,
  to: string,
  valueIn: string,
) {
  return queryOptions({
    queryKey: ["reports", "net-worth", "days", from, to, valueIn] as const,
    queryFn: async () =>
      (
        await unwrap(
          await api.GET("/reports/net-worth/days", {
            params: { query: { from, to, value_in: valueIn } },
          }),
        )
      ).items,
  });
}
