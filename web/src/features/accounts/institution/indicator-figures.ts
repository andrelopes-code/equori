import type { components } from "@/api/schema.gen";

type Indicators = components["schemas"]["InstitutionIndicators"];
type Period = components["schemas"]["InstitutionPeriod"];
type Money = components["schemas"]["Money"];

export type Attention = "warning" | "danger";

interface Floor {
  minimum: number;
  withBuffer: number;
}

interface FigureBase {
  // The values of the quarters that inform one, oldest first: basis points for a ratio, minor
  // units for an amount. A null quarter is left out, never drawn as zero (A237 L4).
  trend: number[];
  // Basis points; absent for a figure the rule sets no floor for.
  floor?: Floor;
  attention?: Attention;
  // An earlier quarter under a floor, named when the newest one has no attention (A237 L6).
  past?: PastEpisode;
}

export interface PastEpisode {
  basisPoints: number;
  // The last day of the quarter, as the API states it.
  period: string;
  level: Attention;
}

export type IndicatorFigure = FigureBase &
  (
    | {
        id: "basel" | "principalCapital" | "fixedAsset";
        kind: "ratio";
        // Null: the source does not inform the value. It is never read as zero.
        basisPoints: number | null;
      }
    | { id: "equity" | "netIncome"; kind: "amount"; money: Money | null }
  );

// The five figures of an institution in the order the tab draws them, read from its newest
// quarter, with the trend of the quarters it holds and the attention a floor gives (A237 L2).
export function indicatorFigures(x: Indicators): IndicatorFigure[] {
  const [latest] = x.periods;
  if (latest === undefined) return [];
  const oldestFirst = [...x.periods].reverse();
  const basel = basisPoints(latest.basel);
  const capital = basisPoints(latest.principal_capital);
  const baselFloor = floorOf(x.limits.basel);
  const capitalFloor = floorOf(x.limits.principal_capital);

  return [
    {
      id: "basel",
      kind: "ratio",
      basisPoints: basel,
      floor: baselFloor,
      ...attentionOf(basel, baselFloor),
      ...pastOf(basel, x.periods, (p) => p.basel, baselFloor),
      trend: ratios(oldestFirst, (p) => p.basel),
    },
    {
      id: "principalCapital",
      kind: "ratio",
      basisPoints: capital,
      floor: capitalFloor,
      ...attentionOf(capital, capitalFloor),
      ...pastOf(capital, x.periods, (p) => p.principal_capital, capitalFloor),
      trend: ratios(oldestFirst, (p) => p.principal_capital),
    },
    {
      id: "fixedAsset",
      kind: "ratio",
      basisPoints: basisPoints(latest.fixed_asset),
      trend: ratios(oldestFirst, (p) => p.fixed_asset),
    },
    {
      id: "equity",
      kind: "amount",
      money: amount(latest.equity, x.currency),
      trend: amounts(oldestFirst, (p) => p.equity),
    },
    {
      id: "netIncome",
      kind: "amount",
      money: amount(latest.net_income, x.currency),
      trend: amounts(oldestFirst, (p) => p.net_income),
    },
  ];
}

// A ratio is a decimal fraction text (0.155 is 15.5%); the screen writes two decimals.
function basisPoints(fraction: string | null): number | null {
  return fraction === null ? null : Math.round(Number(fraction) * 10000);
}

function floorOf(limit: { minimum: string; with_buffer: string }): Floor {
  return {
    minimum: Math.round(Number(limit.minimum) * 10000),
    withBuffer: Math.round(Number(limit.with_buffer) * 10000),
  };
}

// The comparison uses the basis points the screen writes, so a figure shown equal to a floor is
// not below it.
function attentionOf(
  value: number | null,
  floor: Floor,
): { attention?: Attention } {
  if (value === null) return {};
  if (value < floor.minimum) return { attention: "danger" };
  if (value < floor.withBuffer) return { attention: "warning" };
  return {};
}

// Every trend runs from zero, so the five boxes read alike and no axis is cut to exaggerate a
// change; the data still widen the box when a quarter lies under zero (a net loss). A figure with
// a floor draws the floor with the buffer as a dashed reference.
export function trendBounds(floor: Floor | undefined): {
  min: number;
  reference?: number;
} {
  return floor === undefined
    ? { min: 0 }
    : { min: 0, reference: floor.withBuffer };
}

// The lowest earlier quarter under the floor with the buffer, the most recent on a tie. The newest
// quarter is periods[0]; it keeps its own note when it has attention.
function pastOf(
  current: number | null,
  periods: Period[],
  pick: (p: Period) => string | null,
  floor: Floor,
): { past?: PastEpisode } {
  if (current === null || current < floor.withBuffer) return {};
  let worst: PastEpisode | undefined;
  for (const p of periods.slice(1)) {
    const value = basisPoints(pick(p));
    if (value === null || value >= floor.withBuffer) continue;
    if (worst === undefined || value < worst.basisPoints) {
      worst = {
        basisPoints: value,
        period: p.period,
        level: value < floor.minimum ? "danger" : "warning",
      };
    }
  }
  return worst === undefined ? {} : { past: worst };
}

function ratios(
  periods: Period[],
  pick: (p: Period) => string | null,
): number[] {
  return periods.flatMap((p) => {
    const value = basisPoints(pick(p));
    return value === null ? [] : [value];
  });
}

function amounts(
  periods: Period[],
  pick: (p: Period) => number | null,
): number[] {
  return periods.flatMap((p) => {
    const value = pick(p);
    return value === null ? [] : [value];
  });
}

function amount(minor: number | null, currency: string): Money | null {
  return minor === null ? null : { amount: minor, currency };
}
