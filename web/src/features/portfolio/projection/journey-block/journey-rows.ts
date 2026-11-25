import type { components } from "@/api/schema.gen";
import type { CaseKind } from "@/features/portfolio/projection/journey-block/journey-figures";
import type { ProjectionRow } from "@/features/portfolio/projection/model/project";
import { monthEnd } from "@/features/portfolio/projection/journey-block/journey-months";
import { contributed } from "@/features/portfolio/results/model/wealth";

export type JourneyField =
  | "date"
  | "value"
  | "contributed"
  | "projected"
  | "top"
  | "cautious"
  | "favorable";

// One record per date, in major units of the currency: what the chart reads. A series without a
// point on the date reads null.
export interface JourneyRow extends Record<JourneyField, unknown> {
  date: string;
  value: number | null;
  contributed: number | null;
  projected: number | null;
  // The recorded value, then the projection: the upper edge of the area of the return.
  top: number | null;
  // PX15: undefined while the case is not typed.
  cautious: number | null | undefined;
  favorable: number | null | undefined;
}

export type CaseRows = Partial<Record<CaseKind, readonly ProjectionRow[]>>;

// PX6: the recorded value and the money contributed from the history, then the projection and the
// money contributed going on with the contributions of the plan until the withdrawals; the last
// recorded row also carries the projection, so its line starts on today's value.
export function journeyRows(
  history: components["schemas"]["ReturnSeries"],
  projection: readonly ProjectionRow[],
  withdrawalFrom: string,
  scale: number,
  cases: CaseRows = {},
): JourneyRow[] {
  const divisor = 10 ** scale;
  const past = (kind: CaseKind, value: number | null) =>
    cases[kind] === undefined ? undefined : value;
  const ahead = (kind: CaseKind, i: number) => {
    const value = cases[kind]?.[i]?.value;

    return value === undefined ? undefined : value / divisor;
  };
  const sums = contributed(history.opening, history.points);
  const last = history.points.length - 1;

  const recorded = history.points.map((p, i): JourneyRow => {
    const anchor = i === last ? p.value / divisor : null;

    return {
      date: p.date,
      value: p.value / divisor,
      contributed: (sums[i] ?? 0) / divisor,
      projected: anchor,
      top: p.value / divisor,
      cautious: past("cautious", anchor),
      favorable: past("favorable", anchor),
    };
  });
  let sum = sums.at(-1) ?? 0;
  const projected = projection.map((row, i): JourneyRow => {
    sum += row.contribution;

    return {
      date: monthEnd(row.month),
      value: null,
      // Withdrawals take value out, so from here value less contributions is not the return.
      contributed: row.month < withdrawalFrom ? sum / divisor : null,
      projected: row.value / divisor,
      top: row.value / divisor,
      cautious: ahead("cautious", i),
      favorable: ahead("favorable", i),
    };
  });

  return [...recorded, ...projected];
}
