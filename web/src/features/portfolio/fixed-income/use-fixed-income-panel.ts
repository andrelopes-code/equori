import { useQueries, useQuery } from "@tanstack/react-query";

import { useApi } from "@/api/api-context";
import { indexesQuery } from "@/features/calculators";
import { termsQuery } from "@/features/instruments";
import {
  fixedIncomeEventsQuery,
  issuerExposureQuery,
} from "@/features/portfolio/api";
import type { ValuedHolding } from "@/features/portfolio/fixed-income/return-kind";
import type { Holding } from "@/features/portfolio/model/portfolio-holdings";
import { shiftDate } from "@/i18n/format";
import { useToday } from "@/i18n/today";

const windowDays = 90;

export interface FixedIncomeHolding extends ValuedHolding {
  name: string;
  currency: string;
}

// The contracts of the book and what the panel reads for them: terms, indexes, the payments of
// the window and the exposure per issuer (FC36).
export function useFixedIncomePanel(
  holdings: readonly Holding[],
  date: string,
) {
  const api = useApi();
  const today = useToday();
  const fixed: FixedIncomeHolding[] = holdings.flatMap((h) =>
    h.type === "fixed_income" && h.value !== undefined
      ? [{ code: h.code, name: h.name, currency: h.currency, value: h.value }]
      : [],
  );
  // Names come from every contract of the book, priced or not: a payment row names its contract.
  const names = new Map(
    holdings
      .filter((h) => h.type === "fixed_income")
      .map((h) => [h.code, h.name]),
  );
  const codes = [...new Set(fixed.map((h) => h.code))];
  const held = codes.length > 0;

  const terms = useQueries({
    queries: codes.map((code) => termsQuery(api, code)),
    combine: (results) => ({
      pending: results.some((r) => r.isPending),
      byCode: new Map(
        results.flatMap((r, i) =>
          r.data == null ? [] : [[codes[i] ?? "", r.data] as const],
        ),
      ),
    }),
  });
  const indexes = useQuery({ ...indexesQuery(api), enabled: held });
  const events = useQuery({
    ...fixedIncomeEventsQuery(
      api,
      shiftDate(today, -windowDays),
      shiftDate(today, windowDays),
    ),
    enabled: held,
  });
  const report = useQuery({ ...issuerExposureQuery(api, date), enabled: held });

  return {
    fixed,
    names,
    today,
    until: shiftDate(today, windowDays),
    terms: terms.byCode,
    indexes: indexes.data ?? [],
    events: (events.data?.items ?? []).filter((e) => e.state !== "recorded"),
    report: report.data ?? { issuers: [] },
    pending: terms.pending || indexes.isPending || events.isPending,
  };
}
