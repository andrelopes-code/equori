import type { components } from "@/api/schema.gen";
import { largestRemainder } from "@/features/planning/budget-plan/plan-math";
import { measureOf } from "@/features/planning/income-split/bucket-draft";
import type { BucketMeasure } from "@/features/planning/income-split/bucket-draft";
import type { MessageKey } from "@/i18n/catalog.en";

type History = components["schemas"]["BudgetBucketHistory"];
type Method = History["methods"][number];
type Entry = History["months"][number];

const targetKeys: Record<BucketMeasure, MessageKey> = {
  ceiling: "track.target",
  floor: "track.targetFloor",
  savings: "track.targetSavings",
  goals: "track.targetGoals",
};

export type TrackStatus =
  | { kind: "left" | "over"; amount: number }
  | { kind: "saved" | "short"; amount: number }
  | { kind: "reached" | "toGo"; amount: number };

export interface TrackCell {
  month: string;
  target: number | undefined;
  real: number;
  // Undefined in a month without income: no target to keep.
  kept: boolean | undefined;
  state: "kept" | "missed" | "none" | "absent";
}

export interface TrackRow {
  id: string;
  name: string;
  targetBp: number;
  measure: BucketMeasure;
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

// Each bucket of the method of month against its share of the income received (income buckets
// A233): the target splits the income by largest remainder; a ceiling bucket keeps it at or
// below, the savings bucket and a floor bucket at or above (A234); the six months of the history
// give each bucket its strip, each month read through its own version (A242).
export function trackMonth(history: History, month: string): TrackMonth {
  const at = history.months.findIndex((m) => m.month === month);
  const entry = history.months[at];
  const received = entry?.received.amount ?? 0;
  const method = entry === undefined ? undefined : methodOf(history, entry);
  if (method === undefined) return { received, rows: [], missed: undefined };
  const rows = method.buckets.map((b) => {
    const months = history.months.map((m) => monthCell(history, m, b.id));
    const cell = months[at] ?? emptyCell();
    return {
      id: b.id,
      name: b.name,
      targetBp: b.share_bp,
      measure: measureOf(b),
      target: cell.target,
      real: cell.real,
      shareBp:
        received > 0 ? Math.round((cell.real * 10000) / received) : undefined,
      status: statusOf(measureOf(b), cell),
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

function methodOf(history: History, m: Entry): Method | undefined {
  return history.methods.find((v) => v.from === m.from);
}

// The cell of bucket id in month m, computed with the method of m; absent when that method
// holds no such bucket.
function monthCell(history: History, m: Entry, id: string): TrackCell {
  const method = methodOf(history, m);
  const i = method?.buckets.findIndex((b) => b.id === id) ?? -1;
  const bucket = method?.buckets[i];
  if (method === undefined || bucket === undefined) return absentCell(m.month);
  const income = m.received.amount;
  const target =
    income > 0
      ? largestRemainder(
          income,
          method.buckets.map((b) => b.share_bp),
        )[i]
      : undefined;
  const real = m.buckets.find((x) => x.id === id)?.real.amount ?? 0;
  const kept = keptOf(measureOf(bucket), real, target);
  return { month: m.month, target, real, kept, state: stateOf(kept) };
}

// The line under a bucket's name: its target share and what the bucket draws besides its
// categories.
export function targetKey(measure: BucketMeasure): MessageKey {
  return targetKeys[measure];
}

// A ceiling bucket keeps its target at or below it; any other at or above it.
function keptOf(
  measure: BucketMeasure,
  real: number,
  target: number | undefined,
): boolean | undefined {
  if (target === undefined) return undefined;
  return measure === "ceiling" ? real <= target : real >= target;
}

function statusOf(
  measure: BucketMeasure,
  cell: TrackCell,
): TrackStatus | undefined {
  if (cell.target === undefined) return undefined;
  if (measure === "savings")
    return cell.real >= cell.target
      ? { kind: "saved", amount: cell.real }
      : { kind: "short", amount: cell.target - cell.real };
  if (measure !== "ceiling")
    return cell.real >= cell.target
      ? { kind: "reached", amount: cell.real }
      : { kind: "toGo", amount: cell.target - cell.real };
  return cell.real <= cell.target
    ? { kind: "left", amount: cell.target - cell.real }
    : { kind: "over", amount: cell.real - cell.target };
}

function stateOf(kept: boolean | undefined): TrackCell["state"] {
  if (kept === undefined) return "none";
  return kept ? "kept" : "missed";
}

function absentCell(month: string): TrackCell {
  return {
    month,
    target: undefined,
    real: 0,
    kept: undefined,
    state: "absent",
  };
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
