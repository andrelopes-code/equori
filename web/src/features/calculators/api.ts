import { queryOptions } from "@tanstack/react-query";
import type { Client } from "openapi-fetch";

import { unwrap } from "@/api/problem";
import type { paths } from "@/api/schema.gen";
import type { CurvePoint } from "@/features/calculators/indexer-comparison/market-rate";
import type { IndexRate } from "@/features/calculators/rate-source/index-rates";

// The indexes the instance stores; an index's rates never change once published.
export function indexesQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: ["calculators", "indexes"] as const,
    queryFn: async () => (await unwrap(await api.GET("/indexes"))).items,
  });
}

export function indexRatesQuery(
  api: Client<paths>,
  id: string,
  from: string,
  to: string,
) {
  return queryOptions({
    queryKey: ["calculators", "index-rates", id, from, to] as const,
    queryFn: async (): Promise<IndexRate[]> =>
      (
        await unwrap(
          await api.GET("/indexes/{id}/rates", {
            params: { path: { id }, query: { from, to } },
          }),
        )
      ).items.map((r) => ({ date: r.date, rate: Number(r.rate) })),
  });
}

// The latest survey of an index's expected path (ADR 026 E5).
export function indexExpectationsQuery(api: Client<paths>, id: string) {
  return queryOptions({
    queryKey: ["calculators", "index-expectations", id] as const,
    queryFn: async (): Promise<{ surveyDate: string; points: IndexRate[] }> => {
      const x = await unwrap(
        await api.GET("/indexes/{id}/expectations", {
          params: { path: { id } },
        }),
      );
      return {
        surveyDate: x.survey_date,
        points: x.items.map((p) => ({ date: p.date, rate: Number(p.rate) })),
      };
    },
  });
}

// A market curve of a source (IC9): a nominal curve holds fixed rates, a real one the spread
// over the index it names.
export interface MarketCurve {
  id: string;
  kind: string;
  index: string | null;
  currency: string;
  baseDate: string;
  points: CurvePoint[];
}

export function curvesQuery(api: Client<paths>) {
  return queryOptions({
    queryKey: ["calculators", "curves"] as const,
    queryFn: async (): Promise<MarketCurve[]> =>
      (await unwrap(await api.GET("/curves"))).items.map((c) => ({
        id: c.id,
        kind: c.kind,
        index: c.index,
        currency: c.currency,
        baseDate: c.base_date,
        points: c.points.map((p) => ({
          maturity: p.maturity,
          rate: Number(p.rate),
        })),
      })),
  });
}
