import type { components } from "@/api/schema.gen";
import { indexName } from "@/features/calculators";
import { periodDays } from "@/features/portfolio/return/portfolio-period";
import { monthReturns } from "@/features/portfolio/results/model/month-returns";
import {
  annualRate,
  largestFall,
  pointsApart,
  realReturn,
  volatility,
} from "@/features/portfolio/results/model/return-figures";

type ReturnSeries = components["schemas"]["ReturnSeries"];

// The first slot of the data scale is the portfolio's; the indexes take the next ones in order.
const firstIndexSlot = 2;
const lastSlot = 8;

export interface IndexFigure {
  id: string;
  name: string;
  daily: boolean;
  // The first daily index is drawn solid, the others dashed.
  dashed: boolean;
  slot: number;
  // The cumulative return at the last point, as a fraction.
  last: number | null;
  // The portfolio minus the index at the last date both hold, as a fraction; daily indexes only.
  apart: number | null;
}

export interface BlockFigures {
  // The cumulative return of the period, as a fraction.
  total: number | null;
  annual: number | null;
  volatility: number | null;
  fall: { value: number; from: string; to: string } | null;
  real: { value: number; until: string } | null;
  indexes: IndexFigure[];
}

export function blockFigures(series: ReturnSeries): BlockFigures {
  const held = series.points.filter((p) => p.return_bp !== undefined);
  const total = (held.at(-1)?.return_bp ?? null) === null ? null : lastOf(held);
  const inflation = series.indexes.find((i) => i.period === "month");
  const firstDaily = series.indexes.findIndex((i) => i.period === "day");

  return {
    total,
    annual:
      total === null
        ? null
        : annualRate(total, periodDays(series.from, series.to)),
    volatility: volatility(monthReturns(series.points)),
    fall: largestFall(series.points),
    real:
      inflation === undefined
        ? null
        : realReturn(series.points, inflation.points),
    indexes: series.indexes.map((index, position) => ({
      id: index.index,
      name: indexName(index.index),
      daily: index.period === "day",
      // Workaround for Slotted issue #186: the chart has no dotted stroke, so the third reference
      // repeats the dash.
      dashed: position !== firstDaily,
      slot: Math.min(position + firstIndexSlot, lastSlot),
      last: lastOf(index.points),
      apart:
        index.period === "day"
          ? pointsApart(series.points, index.points)
          : null,
    })),
  };
}

// The daily indexes that are switched on and that the portfolio can be compared with.
export function comparisonsOf(
  figures: BlockFigures,
  on: readonly string[],
): { id: string; name: string; points: number }[] {
  return figures.indexes.flatMap((i) =>
    i.apart !== null && on.includes(i.id)
      ? [{ id: i.id, name: i.name, points: i.apart }]
      : [],
  );
}

export function toBasisPoints(fraction: number): number {
  return Math.round(fraction * 10000);
}

function lastOf(points: readonly { return_bp?: number }[]): number | null {
  const bp = points.filter((p) => p.return_bp !== undefined).at(-1)?.return_bp;

  return bp === undefined ? null : bp / 10000;
}
