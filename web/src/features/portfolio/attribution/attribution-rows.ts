import type { components } from "@/api/schema.gen";

type AttributionItem = components["schemas"]["AttributionItem"];

// The rows drawn one by one at each end of the ranking; the ones between add into one row.
export const SHOWN_AT_EACH_END = 5;

export interface AttributionRow {
  key: string;
  // The instrument of the row; absent on the row of the others.
  instrument?: string;
  // How many instruments the row of the others adds.
  others?: number;
  result: number;
  weightBp: number;
  contributionBp: number;
  returnBp?: number | undefined;
  staleSince?: string | undefined;
}

export interface AttributionTally {
  count: number;
  sum: number;
}

export interface AttributionFigures {
  rows: AttributionRow[];
  gains: AttributionTally;
  losses: AttributionTally;
  // The ends of the bar axis, in basis points of contribution; low ≤ 0 ≤ high.
  low: number;
  high: number;
}

// AT7 on screen: the largest and the smallest results one by one, a stale row always on its own
// (AT5 is written, never hidden in a sum), and the rest as one row where they stand in the
// ranking, with the sums of their weights, contributions and results (AT9 keeps the sums exact).
export function attributionFigures(
  items: readonly AttributionItem[],
): AttributionFigures {
  const rows: AttributionRow[] = [];
  const hiddenFrom = SHOWN_AT_EACH_END;
  const hiddenTo = items.length - SHOWN_AT_EACH_END;
  const grouped = hiddenTo - hiddenFrom > 1;
  let others: AttributionRow | undefined;

  items.forEach((item, i) => {
    const hidden =
      grouped &&
      i >= hiddenFrom &&
      i < hiddenTo &&
      item.stale_since === undefined;

    if (!hidden) {
      rows.push(rowOf(item));
      return;
    }

    if (others === undefined) {
      others = {
        key: "others",
        others: 0,
        result: 0,
        weightBp: 0,
        contributionBp: 0,
      };
      rows.push(others);
    }

    others.others = (others.others ?? 0) + 1;
    others.result += item.result.amount;
    others.weightBp += item.weight_bp;
    others.contributionBp += item.contribution_bp;
  });

  // The row of the others is a sum of many holdings: it has no bar and leaves the axis to them.
  const points = rows
    .filter((r) => r.others === undefined)
    .map((r) => r.contributionBp);

  return {
    rows,
    gains: tally(items, (amount) => amount > 0),
    losses: tally(items, (amount) => amount < 0),
    low: Math.min(0, ...points),
    high: Math.max(0, ...points),
  };
}

function rowOf(item: AttributionItem): AttributionRow {
  return {
    key: item.instrument,
    instrument: item.instrument,
    result: item.result.amount,
    weightBp: item.weight_bp,
    contributionBp: item.contribution_bp,
    returnBp: item.return_bp,
    staleSince: item.stale_since,
  };
}

function tally(
  items: readonly AttributionItem[],
  keep: (amount: number) => boolean,
): AttributionTally {
  const kept = items.filter((item) => keep(item.result.amount));

  return {
    count: kept.length,
    sum: kept.reduce((total, item) => total + item.result.amount, 0),
  };
}

export interface BarSpan {
  // Percentages of the track: where zero stands, where the bar starts and how wide it is.
  zero: number;
  start: number;
  size: number;
}

// The bar of value on the axis [low, high], low ≤ 0 ≤ high; an empty axis draws nothing.
export function barSpan(low: number, high: number, value: number): BarSpan {
  const range = high - low;
  if (range === 0) return { zero: 0, start: 0, size: 0 };

  return {
    zero: (-low / range) * 100,
    start: ((Math.min(value, 0) - low) / range) * 100,
    size: (Math.abs(value) / range) * 100,
  };
}
