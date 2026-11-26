import type { components } from "@/api/schema.gen";
import { largestRemainder } from "@/features/planning/budget-plan/model/plan-math";
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
  // The amount judged against the target (planning coherence A254): a ceiling bucket's real
  // amount less what goals and the accumulated balance of its budgets paid, the deposits of the
  // goals bucket, the real amount of any other.
  counted: number;
  // Spending paid by the accumulated balance of rollover budgets and by goals.
  covered: number;
  goalPaid: number;
  // What went into the goals and what left them; undefined outside the goals bucket.
  deposited: number | undefined;
  withdrawn: number | undefined;
  // Undefined in a month without income: no target to keep.
  kept: boolean | undefined;
  state: "kept" | "missed" | "none" | "absent";
  // The month is the start of a version that is not the first.
  changed: boolean;
}

export interface TrackRow {
  id: string;
  name: string;
  targetBp: number;
  measure: BucketMeasure;
  target: number | undefined;
  real: number;
  // The cell of the month on screen, with the figures of its verdict.
  cell: TrackCell;
  // The real amount as basis points of the income received; undefined without income.
  shareBp: number | undefined;
  status: TrackStatus | undefined;
  months: TrackCell[];
}

export interface TrackMonth {
  received: number;
  // The income that no bucket and no spending took; negative when balances paid spending (A235).
  unallocated: number;
  // Yields that stayed in the investments, outside the income received (A252).
  retained: number;
  rows: TrackRow[];
  // Buckets that missed their target; undefined without income.
  missed: number | undefined;
  // The version of the month on screen; first when it is the first version of the book.
  since: { from: string; first: boolean } | undefined;
}

// Each bucket of the method of month against its share of the income received (income buckets
// A233): the target splits the income by largest remainder; a ceiling bucket keeps it at or
// below, the savings bucket and a floor bucket at or above (A234); the six months of the history
// give each bucket its strip, each month read through its own version (A242).
export function trackMonth(
  history: History,
  month: string,
  firstFrom: string | undefined,
): TrackMonth {
  const at = history.months.findIndex((m) => m.month === month);
  const entry = history.months[at];
  const received = entry?.received.amount ?? 0;
  const unallocated = entry?.unallocated.amount ?? 0;
  const retained = entry?.retained.amount ?? 0;
  const method = entry === undefined ? undefined : methodOf(history, entry);
  if (method === undefined)
    return {
      received,
      unallocated,
      retained,
      rows: [],
      missed: undefined,
      since: undefined,
    };
  const rows = method.buckets.map((b) => {
    const months = history.months.map((m) =>
      monthCell(history, m, b.id, firstFrom),
    );
    const cell = months[at] ?? emptyCell();
    return {
      id: b.id,
      name: b.name,
      targetBp: b.share_bp,
      measure: measureOf(b),
      target: cell.target,
      real: cell.real,
      cell,
      shareBp:
        received > 0 ? Math.round((cell.real * 10000) / received) : undefined,
      status: cellStatus(measureOf(b), cell),
      months,
    };
  });
  return {
    received,
    unallocated,
    retained,
    rows,
    missed:
      received > 0
        ? rows.filter((r) => r.months[at]?.kept === false).length
        : undefined,
    since: { from: method.from, first: method.from === firstFrom },
  };
}

function methodOf(history: History, m: Entry): Method | undefined {
  return history.methods.find((v) => v.from === m.from);
}

// The cell of bucket id in month m, computed with the method of m; absent when that method
// holds no such bucket.
function monthCell(
  history: History,
  m: Entry,
  id: string,
  firstFrom: string | undefined,
): TrackCell {
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
  const figures = m.buckets.find((x) => x.id === id);
  const real = figures?.real.amount ?? 0;
  const covered = figures?.covered.amount ?? 0;
  const goalPaid = figures?.goal_paid.amount ?? 0;
  const measure = measureOf(bucket);
  const deposited =
    measure === "goals" ? figures?.deposited?.amount : undefined;
  const counted =
    measure === "ceiling" ? real - goalPaid - covered : (deposited ?? real);
  const kept = keptOf(measure, counted, target);
  // Without the list of versions the first one is unknown: no month is marked.
  const changed =
    firstFrom !== undefined &&
    m.month === method.from &&
    method.from !== firstFrom;
  return {
    month: m.month,
    target,
    real,
    counted,
    covered,
    goalPaid,
    deposited,
    withdrawn: measure === "goals" ? figures?.withdrawn?.amount : undefined,
    kept,
    state: stateOf(kept),
    changed,
  };
}

// The line under a bucket's name: its target share and what the bucket draws besides its
// categories.
export function targetKey(measure: BucketMeasure): MessageKey {
  return targetKeys[measure];
}

// A ceiling bucket keeps its target with its counted amount at or below it; any other at or
// above it (planning coherence A254).
function keptOf(
  measure: BucketMeasure,
  counted: number,
  target: number | undefined,
): boolean | undefined {
  if (target === undefined) return undefined;
  return measure === "ceiling" ? counted <= target : counted >= target;
}

export interface TrackDetail {
  key:
    | "track.real"
    | "track.realPlain"
    | "track.realCovered"
    | "track.realGoalPaid"
    | "track.realBoth"
    | "track.deposited"
    | "track.depositedWithdrawn";
  // The amounts the text names, by placeholder.
  amounts: Record<string, number>;
  shareBp?: number;
}

// The second line of a bucket's figures: what the goals received and returned, what the
// accumulated balance or a goal paid of a ceiling bucket, else the real amount and its share of
// the income (planning coherence A254).
export function trackDetail(row: TrackRow): TrackDetail {
  const { cell, real: amount } = row;
  const { covered, goalPaid: paid, deposited, withdrawn = 0 } = cell;
  if (deposited !== undefined)
    return withdrawn > 0
      ? { key: "track.depositedWithdrawn", amounts: { deposited, withdrawn } }
      : { key: "track.deposited", amounts: { deposited } };
  if (covered > 0 && paid > 0)
    return { key: "track.realBoth", amounts: { amount, covered, paid } };
  if (covered > 0)
    return { key: "track.realCovered", amounts: { amount, covered } };
  if (paid > 0) return { key: "track.realGoalPaid", amounts: { amount, paid } };
  if (row.shareBp === undefined)
    return { key: "track.realPlain", amounts: { amount } };
  return { key: "track.real", amounts: { amount }, shareBp: row.shareBp };
}

// What a bucket left, spent over, saved or still owes in the month of a cell; undefined without a
// target.
export function cellStatus(
  measure: BucketMeasure,
  cell: TrackCell,
): TrackStatus | undefined {
  if (cell.target === undefined) return undefined;
  if (measure === "savings")
    return cell.counted >= cell.target
      ? { kind: "saved", amount: cell.counted }
      : { kind: "short", amount: cell.target - cell.counted };
  if (measure !== "ceiling")
    return cell.counted >= cell.target
      ? { kind: "reached", amount: cell.counted }
      : { kind: "toGo", amount: cell.target - cell.counted };
  return cell.counted <= cell.target
    ? { kind: "left", amount: cell.target - cell.counted }
    : { kind: "over", amount: cell.counted - cell.target };
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
    counted: 0,
    covered: 0,
    goalPaid: 0,
    deposited: undefined,
    withdrawn: undefined,
    kept: undefined,
    state: "absent",
    changed: false,
  };
}

function emptyCell(): TrackCell {
  return {
    month: "",
    target: undefined,
    real: 0,
    counted: 0,
    covered: 0,
    goalPaid: 0,
    deposited: undefined,
    withdrawn: undefined,
    kept: undefined,
    state: "none",
    changed: false,
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
