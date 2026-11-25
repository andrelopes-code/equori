import type { components } from "@/api/schema.gen";
import { blockFigures } from "@/features/portfolio/results/return-block/block-figures";
import {
  portfolioField,
  type PlotRow,
} from "@/features/portfolio/results/return-block/plot-rows";
import {
  monthReturns,
  wholeMonths,
} from "@/features/portfolio/results/model/month-returns";
import {
  rollingWindows,
  shareAbove,
  shareOf,
  type Share,
  type Window,
} from "@/features/portfolio/results/model/rolling-windows";

type ReturnSeries = components["schemas"]["ReturnSeries"];

// PR7: only the first two indexes of the series have a tile of their own.
const comparedIndexes = 2;

export interface IndexWindows {
  id: string;
  name: string;
  slot: number;
  // The first daily index is drawn solid, the others dashed.
  dashed: boolean;
  windows: Window[];
  // The share of the windows of the portfolio above the window of the index with the same end;
  // absent beyond the first two indexes and for an index that shares no end.
  above: Share | null;
}

export interface WindowFigures {
  windows: Window[];
  // The whole months of history the series holds.
  months: number;
  // The date the first window closes: the end of the twelfth whole month.
  firstClose: string;
  extremes: { best: Window; worst: Window } | null;
  negative: Share;
  indexes: IndexWindows[];
}

export function windowFigures(series: ReturnSeries): WindowFigures {
  const months = wholeMonthsOf(series, series.points);
  const windows = rollingWindows(months);
  const indexes = blockFigures(series).indexes.map(
    (meta, position): IndexWindows => {
      const own = rollingWindows(
        wholeMonthsOf(series, series.indexes[position]?.points ?? []),
      );
      const above = shareAbove(windows, own);

      return {
        id: meta.id,
        name: meta.name,
        slot: meta.slot,
        dashed: meta.dashed,
        windows: own,
        above: position < comparedIndexes && above.total > 0 ? above : null,
      };
    },
  );
  const below = windows.filter((w) => w.value < 0).length;

  return {
    windows,
    months: months.length,
    firstClose: firstClose(series.from),
    extremes: extremesOf(windows),
    negative: shareOf(below, windows.length),
    indexes,
  };
}

// One record per window for the plot: the portfolio, the two bounds of the area below zero and the
// window of each index with the same end (null where the index has none).
export function windowRows(figures: WindowFigures): PlotRow[] {
  return figures.windows.map((w) => {
    const row: PlotRow = {
      date: `${w.end}-01`,
      [portfolioField]: w.value,
      lower: Math.min(w.value, 0),
      upper: 0,
    };
    for (const index of figures.indexes)
      row[index.id] = index.windows.find((x) => x.end === w.end)?.value ?? null;

    return row;
  });
}

function wholeMonthsOf(
  series: ReturnSeries,
  points: readonly { date: string; return_bp?: number }[],
) {
  return wholeMonths(monthReturns(points), series.from, series.to);
}

function extremesOf(windows: readonly Window[]): WindowFigures["extremes"] {
  const [first, ...rest] = windows;
  if (first === undefined) return null;

  return {
    best: rest.reduce((a, w) => (w.value > a.value ? w : a), first),
    worst: rest.reduce((a, w) => (w.value < a.value ? w : a), first),
  };
}

// The end of the twelfth whole month from the start; a month starts whole on its first day.
function firstClose(from: string): string {
  const [year = 0, month = 1, day = 1] = from.split("-").map(Number);
  const firstWhole = day === 1 ? month : month + 1;

  return new Date(Date.UTC(year, firstWhole + 11, 0))
    .toISOString()
    .slice(0, 10);
}
