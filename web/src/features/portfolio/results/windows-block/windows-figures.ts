import type { components } from "@/api/schema.gen";
import { blockFigures } from "@/features/portfolio/results/return-block/block-figures";
import {
  portfolioField,
  type PlotRow,
} from "@/features/portfolio/results/return-block/plot-rows";
import { monthReturns } from "@/features/portfolio/results/model/month-returns";
import {
  rollingWindows,
  shareAbove,
  type Window,
} from "@/features/portfolio/results/model/rolling-windows";

type ReturnSeries = components["schemas"]["ReturnSeries"];

// PR7: only the first two indexes of the series have a tile of their own.
const comparedIndexes = 2;

export interface Share {
  count: number;
  // A fraction from 0 to 1.
  share: number;
}

export interface IndexWindows {
  id: string;
  name: string;
  slot: number;
  // The first daily index is drawn solid, the others dashed.
  dashed: boolean;
  windows: Window[];
  // The share of the windows of the portfolio above the window of the index with the same end;
  // absent beyond the first two indexes.
  above: Share | null;
}

export interface WindowFigures {
  windows: Window[];
  // The months of history the series holds.
  months: number;
  // The date the first window closes: a year after the series starts.
  firstClose: string;
  extremes: { last: Window; best: Window; worst: Window } | null;
  negative: Share;
  indexes: IndexWindows[];
}

export function windowFigures(series: ReturnSeries): WindowFigures {
  const months = monthReturns(series.points);
  const windows = rollingWindows(months);
  const indexes = blockFigures(series).indexes.map(
    (meta, position): IndexWindows => {
      const own = rollingWindows(
        monthReturns(series.indexes[position]?.points ?? []),
      );

      return {
        id: meta.id,
        name: meta.name,
        slot: meta.slot,
        dashed: meta.dashed,
        windows: own,
        above:
          position < comparedIndexes
            ? shareOf(windows, shareAbove(windows, own))
            : null,
      };
    },
  );
  const below = windows.filter((w) => w.value < 0).length;

  return {
    windows,
    months: months.length,
    firstClose: yearAfter(series.from),
    extremes: extremesOf(windows),
    negative: {
      count: below,
      share: windows.length === 0 ? 0 : below / windows.length,
    },
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

function shareOf(windows: readonly Window[], share: number): Share {
  return { count: Math.round(share * windows.length), share };
}

function extremesOf(windows: readonly Window[]): WindowFigures["extremes"] {
  const [first, ...rest] = windows;
  if (first === undefined) return null;

  return {
    last: windows.at(-1) ?? first,
    best: rest.reduce((a, w) => (w.value > a.value ? w : a), first),
    worst: rest.reduce((a, w) => (w.value < a.value ? w : a), first),
  };
}

// The same day a year later; 29 February reads 28 February.
function yearAfter(iso: string): string {
  const [year = 0, month = 1, day = 1] = iso.split("-").map(Number);
  const next = new Date(Date.UTC(year + 1, month - 1, day));
  if (next.getUTCMonth() !== month - 1)
    return new Date(Date.UTC(year + 1, month, 0)).toISOString().slice(0, 10);

  return next.toISOString().slice(0, 10);
}
