import type { Indicators, RatioKey } from "@/features/overview";

export type AmountKey = "income" | "expense" | "liquid_balance" | "liabilities";
export type PositionKind = Exclude<RatioKey, "trailing_savings_rate">;

type Reason = "no_income" | "no_expense" | "insufficient_history";

export type PositionState =
  | { kind: "reason"; reason: Reason }
  | { kind: "short" }
  // debt_service_share is 0 in every drawn month.
  | { kind: "none" }
  | {
      kind: "strip";
      // The smallest and largest drawn value, the mean and the current month included.
      min: number;
      max: number;
      // The drawn months before the asked one.
      dots: { index: number; bp: number }[];
      // The smallest and largest of dots.
      band: [number, number];
      // The band holds one value.
      flat: boolean;
      current: number;
      // The asked month is incomplete and its savings rate is not drawn.
      markerHidden: boolean;
      // trailing_savings_rate of the asked month, on the savings row only.
      mean: number | null;
    };

export interface PositionRow {
  kind: PositionKind;
  // The asked month's value in basis points, written beside the strip.
  value: number | null;
  state: PositionState;
}

const positionKinds: readonly PositionKind[] = [
  "savings_rate",
  "liquidity",
  "committed_share",
  "debt_service_share",
];

// The fewest months with a value that make a range: two make only a segment.
const rangeFloor = 3;

const amountKeys: readonly AmountKey[] = [
  "income",
  "expense",
  "liquid_balance",
  "liabilities",
];

// The index of the first month with a non-zero amount; 12 when none. The payload holds zeros
// before the first posting, and a zero there is no record, not a value (spec D4).
export function activeFrom(report: Indicators): number {
  const index = report.months.findIndex((m) =>
    amountKeys.some((key) => m[key].amount !== 0),
  );

  return index === -1 ? report.months.length : index;
}

// The ratio of each month in basis points. A ratio with a reason, a month before the first active
// one and the savings rate of an incomplete last month are null (spec D3, D4).
export function ratioSeries(
  report: Indicators,
  kind: RatioKey,
  incomplete: boolean,
): (number | null)[] {
  const from = activeFrom(report);
  const last = report.months.length - 1;

  return report.months.map((m, i) => {
    if (i < from) return null;

    if (incomplete && kind === "savings_rate" && i === last) return null;

    return m[kind].bp ?? null;
  });
}

// The amount of each month in minor units; null before the first active month.
export function amountSeries(
  report: Indicators,
  kind: AmountKey,
): (number | null)[] {
  const from = activeFrom(report);

  return report.months.map((m, i) => (i < from ? null : m[kind].amount));
}

// One row per ratio of the position card: where the asked month stands among the 12.
export function positionRows(
  report: Indicators,
  incomplete: boolean,
): PositionRow[] {
  return positionKinds.map((kind) => positionRow(report, kind, incomplete));
}

function positionRow(
  report: Indicators,
  kind: PositionKind,
  incomplete: boolean,
): PositionRow {
  const asked = report.months[report.months.length - 1];
  const ratio = asked?.[kind];
  const value = ratio?.bp ?? null;

  if (ratio?.reason !== undefined && value === null)
    return { kind, value, state: { kind: "reason", reason: ratio.reason } };

  const series = ratioSeries(report, kind, incomplete);
  const drawn = series.filter((bp) => bp !== null);

  if (value === null || drawn.length < rangeFloor)
    return { kind, value, state: { kind: "short" } };

  if (kind === "debt_service_share" && drawn.every((bp) => bp === 0))
    return { kind, value, state: { kind: "none" } };

  return { kind, value, state: strip(report, kind, series, value) };
}

function strip(
  report: Indicators,
  kind: PositionKind,
  series: (number | null)[],
  current: number,
): PositionState {
  const last = series.length - 1;
  const dots = series.flatMap((bp, index) =>
    bp !== null && index < last ? [{ index, bp }] : [],
  );
  const mean =
    kind === "savings_rate"
      ? (report.months[last]?.trailing_savings_rate.bp ?? null)
      : null;
  const band: [number, number] = [
    Math.min(...dots.map((d) => d.bp)),
    Math.max(...dots.map((d) => d.bp)),
  ];
  const all = [...band, current, ...(mean === null ? [] : [mean])];

  return {
    kind: "strip",
    min: Math.min(...all),
    max: Math.max(...all),
    dots,
    band,
    flat: band[0] === band[1],
    current,
    markerHidden: series[last] === null,
    mean,
  };
}
