import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import type { Client } from "openapi-fetch";

import { useApi } from "@/api/api-context";
import { unwrap } from "@/api/problem";
import { ProblemError } from "@/api/problem-error";
import type { components, paths } from "@/api/schema.gen";
import type { AllocationBy } from "@/features/portfolio/model/portfolio-search";
import type { PlanEdit } from "@/features/portfolio/contribution-plan/panel/model/criteria-edits";

type Plan = components["schemas"]["ContributionPlan"];

// The group, the criterion or the asset of a change is gone from the plan.
export class PlanMovedError extends Error {}

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

// AT1 to AT7 (docs/specs/2026-11-20-portfolio-attribution-design.md): every year at once, so the
// choice of a year never waits for the network.
export function attributionQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: ["attribution"] as const,
    queryFn: async () => unwrap(await api.GET("/reports/attribution")),
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

export function returnSeriesQuery(
  api: Client<paths>,
  accountID: string | null | undefined,
  from: string | undefined,
  to: string,
  step: "day" | "week" | "month",
  valueIn: string | undefined,
  enabled: boolean,
) {
  return queryOptions({
    queryKey: ["return-series", accountID, from, to, step, valueIn] as const,
    queryFn: async () =>
      unwrap(
        await api.GET("/reports/return/series", {
          params: {
            query: {
              ...(accountID === null || accountID === undefined
                ? {}
                : { account_id: accountID }),
              ...(from === undefined ? {} : { from }),
              to,
              step,
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

// One change of the saved plan at a time, over the plan of the cache. A save refused because the plan
// changed is read again and applied once more (CO15); PlanMovedError says the change has no place in
// the plan read.
export function useEditContributionPlan() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    scope: { id: "contribution-plan" },
    mutationFn: async (edit: PlanEdit) => {
      const query = contributionPlanQuery(api);
      const before = await queryClient.query({ ...query, staleTime: "static" });
      const put = async (plan: Plan) => {
        const body = edit(plan);
        if (body === undefined) throw new PlanMovedError();

        return unwrap(await api.PUT("/contribution-plan", { body }));
      };

      const saved = await put(before).catch(async (error: unknown) => {
        if (!planChanged(error)) throw error;

        return put(await queryClient.query({ ...query, staleTime: 0 }));
      });
      queryClient.setQueryData(query.queryKey, saved);

      return { before, saved };
    },
    onError: (error) => {
      if (error instanceof PlanMovedError || planChanged(error)) {
        void queryClient.invalidateQueries({
          queryKey: contributionPlanQuery(api).queryKey,
        });
      }
    },
  });
}

export function sentimentQuery(api: Client<paths>, id: string) {
  return queryOptions({
    queryKey: ["sentiment-index", id] as const,
    queryFn: async () =>
      unwrap(
        await api.GET("/sentiment-indexes/{id}", { params: { path: { id } } }),
      ),
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

// PJ5: a member without a plan answers 404, which is "no plan" and not an error.
export function projectionQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: ["portfolio-projection"] as const,
    queryFn: async () => {
      const result = await api.GET("/portfolio-projection");
      if (result.response.status === 404) return null;

      return unwrap(result);
    },
  });
}

export function useSaveProjection() {
  const api = useApi();

  return useMutation({
    mutationFn: async (body: components["schemas"]["ProjectionPlanInput"]) =>
      unwrap(await api.PUT("/portfolio-projection", { body })),
  });
}

export function useDeleteProjection() {
  const api = useApi();

  return useMutation({
    mutationFn: async () => {
      await unwrap(await api.DELETE("/portfolio-projection"));
    },
  });
}

// The save was refused because the plan changed since it was read (CO15).
export function planChanged(error: unknown): boolean {
  return (
    error instanceof ProblemError &&
    error.problem.code === "contribution_plan_changed"
  );
}

export function openingLossesQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: ["opening-losses"] as const,
    queryFn: async () => unwrap(await api.GET("/gain-tax/opening-losses")),
  });
}

// LO4: the whole set replaces the saved one; the monthly tax reads it, so the tax of the years is
// read again.
export function useSaveOpeningLosses() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (losses: components["schemas"]["OpeningLoss"][]) =>
      unwrap(await api.PUT("/gain-tax/opening-losses", { body: { losses } })),
    onSuccess: (saved) => {
      queryClient.setQueryData(openingLossesQuery(api).queryKey, saved);
      void queryClient.invalidateQueries({ queryKey: ["gain-tax"] });
    },
  });
}
