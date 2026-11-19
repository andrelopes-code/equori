import { queryOptions, useMutation } from "@tanstack/react-query";
import type { Client } from "openapi-fetch";

import { useApi } from "@/api/api-context";
import { unwrap } from "@/api/problem";
import type { components, paths } from "@/api/schema.gen";
import type { AllocationBy } from "@/features/portfolio/model/portfolio-search";

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

// The balance of an account valued in a currency; an account it cannot value answers a problem.
export function valuedBalanceQuery(
  api: Client<paths>,
  id: string,
  date: string,
  valueIn: string | undefined,
) {
  return queryOptions({
    queryKey: ["valued-balance", id, date, valueIn] as const,
    queryFn: async () =>
      unwrap(
        await api.GET("/accounts/{id}/balance", {
          params: {
            path: { id },
            query: {
              date,
              ...(valueIn === undefined ? {} : { value_in: valueIn }),
            },
          },
        }),
      ),
    enabled: valueIn !== undefined,
    retry: false,
  });
}

export function returnQuery(
  api: Client<paths>,
  accountID: string | null | undefined,
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
              ...(accountID === null || accountID === undefined
                ? {}
                : { account_id: accountID }),
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

export function gainTaxQuery(api: Client<paths>, year: number) {
  return queryOptions({
    queryKey: ["gain-tax", year] as const,
    queryFn: async () =>
      unwrap(await api.GET("/gain-tax", { params: { query: { year } } })),
  });
}

export function incomeEventsQuery(api: Client<paths>, year: number) {
  return queryOptions({
    queryKey: ["income-events", year] as const,
    queryFn: async () =>
      unwrap(await api.GET("/income-events", { params: { query: { year } } })),
  });
}

export function contributionPlanQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: ["contribution-plan"] as const,
    queryFn: async () => unwrap(await api.GET("/contribution-plan")),
  });
}

export function useSaveContributionPlan() {
  const api = useApi();

  return useMutation({
    mutationFn: async (body: components["schemas"]["ContributionPlanInput"]) =>
      unwrap(await api.PUT("/contribution-plan", { body })),
  });
}

export function usePreviewContributionPlan() {
  const api = useApi();

  return useMutation({
    mutationFn: async (
      body: components["schemas"]["ContributionPreviewInput"],
    ) => unwrap(await api.POST("/contribution-plan/preview", { body })),
  });
}

// The monthly risk history of the portfolio up to date (portfolio risk design, RK14).
export function riskQuery(
  api: Client<paths>,
  date: string,
  valueIn: string | undefined,
) {
  return queryOptions({
    queryKey: ["risk", date, valueIn] as const,
    queryFn: async () =>
      unwrap(
        await api.GET("/reports/risk", {
          params: {
            query: {
              to: date,
              ...(valueIn === undefined ? {} : { value_in: valueIn }),
            },
          },
        }),
      ),
    enabled: valueIn !== undefined,
  });
}

export function issuerExposureQuery(api: Client<paths>, date: string) {
  return queryOptions({
    queryKey: ["issuer-exposure", date] as const,
    queryFn: async () =>
      unwrap(
        await api.GET("/issuer-exposure", { params: { query: { date } } }),
      ),
  });
}

export function fixedIncomeEventsQuery(
  api: Client<paths>,
  from: string,
  to: string,
) {
  return queryOptions({
    queryKey: ["fixed-income-events", from, to] as const,
    queryFn: async () =>
      unwrap(
        await api.GET("/fixed-income-events", {
          params: { query: { from, to } },
        }),
      ),
  });
}
