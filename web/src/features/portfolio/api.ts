import { queryOptions } from "@tanstack/react-query";
import type { Client } from "openapi-fetch";

import { unwrap } from "@/api/problem";
import type { paths } from "@/api/schema.gen";
import type { AllocationBy } from "@/features/portfolio/portfolio-search";

export function allocationQuery(
  api: Client<paths>,
  date: string,
  by: AllocationBy,
  valueIn: string | undefined,
) {
  return queryOptions({
    queryKey: ["allocation", date, by, valueIn] as const,
    queryFn: async () =>
      unwrap(
        await api.GET("/reports/allocation", {
          params: {
            query: {
              date,
              by,
              ...(valueIn === undefined ? {} : { value_in: valueIn }),
            },
          },
        }),
      ),
    enabled: valueIn !== undefined,
  });
}

export function returnQuery(
  api: Client<paths>,
  accountID: string | undefined,
  from: string,
  to: string,
  valueIn: string | undefined,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: ["return", accountID, from, to, valueIn] as const,
    queryFn: async () =>
      unwrap(
        await api.GET("/reports/return", {
          params: {
            query: {
              account_id: accountID ?? "",
              from,
              to,
              ...(valueIn === undefined ? {} : { value_in: valueIn }),
            },
          },
        }),
      ),
    enabled: enabled && accountID !== undefined && valueIn !== undefined,
  });
}

export function realizedResultsQuery(api: Client<paths>, year: number) {
  return queryOptions({
    queryKey: ["realized-results", year] as const,
    queryFn: async () =>
      unwrap(
        await api.GET("/realized-results", { params: { query: { year } } }),
      ),
  });
}
