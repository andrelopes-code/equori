import type { components } from "@/api/schema.gen";
import { largestRemainder } from "@/features/planning/budget-plan/plan-math";

type History = components["schemas"]["BudgetBucketHistory"];

export type TrackStatus =
  | { kind: "left" | "over"; amount: number }
  | { kind: "saved" | "short"; amount: number };

export interface TrackCell {
  month: string;
  target: number | undefined;
  real: number;
  // Undefined in a month without income: no target to keep.
  kept: boolean | undefined;
  state: "kept" | "missed" | "none";
}

export interface TrackRow {
  id: string;
  name: string;
  targetBp: number;
  takesSavings: boolean;
  target: number | undefined;
  real: number;
  // The real amount as basis points of the income received; undefined without income.
  shareBp: number | undefined;
  status: TrackStatus | undefined;
  months: TrackCell[];
}

export interface TrackMonth {
  received: number;
  rows: TrackRow[];
  // Buckets that missed their target; undefined without income.
  missed: number | undefined;
}

// Each bucket of month against its share of the income received (income buckets A233): the
// target splits the income by largest remainder; an expense bucket keeps it at or below, the
// savings bucket at or above; the six months of the history give each bucket its strip.
export function trackMonth(history: History, month: string): TrackMonth {
  const cells = history.months.map((m) => monthCells(history, m));
  const at = history.months.findIndex((m) => m.month === month);
  const received = history.months[at]?.received.amount ?? 0;
  const rows = history.buckets.map((b, i) => {
    const months = cells.map((c) => c[i] ?? emptyCell());
    const cell = months[at] ?? emptyCell();
    return {
      id: b.id,
      name: b.name,
      targetBp: b.share_bp,
      takesSavings: b.takes_savings,
      target: cell.target,
      real: cell.real,
      shareBp:
        received > 0 ? Math.round((cell.real * 10000) / received) : undefined,
      status: statusOf(b.takes_savings, cell),
      months,
    };
  });
  return {
    received,
    rows,
    missed:
      received > 0
        ? rows.filter((r) => r.months[at]?.kept === false).length
        : undefined,
  };
}

function monthCells(
  history: History,
  m: History["months"][number],
): TrackCell[] {
  const income = m.received.amount;
  const targets =
    income > 0
      ? largestRemainder(
          income,
          history.buckets.map((b) => b.share_bp),
        )
      : undefined;
  return history.buckets.map((b, i) => {
    const real = m.buckets.find((x) => x.id === b.id)?.real.amount ?? 0;
    const target = targets?.[i];
    const kept = keptOf(b.takes_savings, real, target);
    return { month: m.month, target, real, kept, state: stateOf(kept) };
  });
}

// An expense bucket keeps its target at or below it, the savings bucket at or above it.
function keptOf(
  savings: boolean,
  real: number,
  target: number | undefined,
): boolean | undefined {
  if (target === undefined) return undefined;
  return savings ? real >= target : real <= target;
}

function statusOf(savings: boolean, cell: TrackCell): TrackStatus | undefined {
  if (cell.target === undefined) return undefined;
  if (savings)
    return cell.real >= cell.target
      ? { kind: "saved", amount: cell.real }
      : { kind: "short", amount: cell.target - cell.real };
  return cell.real <= cell.target
    ? { kind: "left", amount: cell.target - cell.real }
    : { kind: "over", amount: cell.real - cell.target };
}

function stateOf(kept: boolean | undefined): TrackCell["state"] {
  if (kept === undefined) return "none";
  return kept ? "kept" : "missed";
}

function emptyCell(): TrackCell {
  return {
    month: "",
    target: undefined,
    real: 0,
    kept: undefined,
    state: "none",
  };
}

export type TrackVerdict =
  | {
      key:
        "track.verdict.noIncome" | "track.verdict.kept" | "track.verdict.one";
    }
  | { key: "track.verdict.missed"; count: number };

// The sentence that answers the month before any figure.
export function trackVerdict(track: TrackMonth): TrackVerdict {
  if (track.missed === undefined) return { key: "track.verdict.noIncome" };
  if (track.missed === 0) return { key: "track.verdict.kept" };
  if (track.missed === 1) return { key: "track.verdict.one" };
  return { key: "track.verdict.missed", count: track.missed };
}
