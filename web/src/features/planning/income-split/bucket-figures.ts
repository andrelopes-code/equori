import type { components } from "@/api/schema.gen";
import type { CategoryEntry } from "@/features/categories";
import type {
  PlanGroup,
  PlanLine,
} from "@/features/planning/budget-plan/model/plan-groups";
import { largestRemainder } from "@/features/planning/budget-plan/model/plan-math";
import type { PlanDraftRow } from "@/features/planning/budget-plan/model/plan-math";
import { measureOf } from "@/features/planning/income-split/bucket-draft";
import type { BucketMeasure } from "@/features/planning/income-split/bucket-draft";

type Bucket = components["schemas"]["BudgetPlanBucket"];
type MethodBucket = components["schemas"]["BudgetBucket"];

export interface BucketFigure {
  id: string;
  name: string;
  shareBp: number;
  measure: BucketMeasure;
  // Absent without a reference.
  target: number | undefined;
  planned: number;
  spent: number;
}

// What the plan commits outside the budgets (planning coherence A253).
export interface PlanMovements {
  installments: number;
  savings: number;
  goalDeposits: number;
}

// A figure of the plan that no bucket takes, as a row of its own (A258).
export interface OutsideRow {
  key: keyof PlanMovements;
  amount: number;
}

export interface BucketTotals {
  buckets: BucketFigure[];
  outsidePlanned: number;
  // Earlier installments, and the savings and goal deposits no bucket takes, above zero. With
  // the planned amounts and what is left to distribute they sum to the reference.
  rows: OutsideRow[];
}

export const outsideBucket = "outside";

// The bucket a category resolves to: its own, or that of its nearest ancestor that sits in
// one (income buckets A229); undefined outside the method.
export function bucketResolver<B extends MethodBucket>(
  buckets: readonly B[],
  entries: readonly CategoryEntry[],
): (categoryId: string) => B | undefined {
  const placed = new Map<string, B>();
  for (const b of buckets) for (const id of b.category_ids) placed.set(id, b);
  const parents = new Map(entries.map((e) => [e.id, e.parentId]));
  return (categoryId) => {
    const seen = new Set<string>();
    let id: string | undefined = categoryId;
    while (id !== undefined && !seen.has(id)) {
      const b = placed.get(id);
      if (b !== undefined) return b;
      seen.add(id);
      id = parents.get(id);
    }
    return undefined;
  };
}

// Each bucket's target, planned and spent amounts as the draft stands (A230): the targets
// split the draft reference, planned sums the counted draft rows plus the savings of the
// bucket that takes them and the goal deposits of the bucket that takes the goals (planning
// coherence A253), and spent is the server's figure of the month.
export function bucketFigures(
  buckets: readonly Bucket[],
  entries: readonly CategoryEntry[],
  rows: readonly PlanDraftRow[],
  reference: number | undefined,
  movements: PlanMovements,
): BucketTotals {
  const { savings, goalDeposits } = movements;
  const resolve = bucketResolver(buckets, entries);
  const targets =
    reference === undefined
      ? undefined
      : largestRemainder(
          reference,
          buckets.map((b) => b.share_bp),
        );
  const planned = new Map<string, number>();
  let outsidePlanned = 0;
  for (const r of rows) {
    if (!r.counted) continue;
    const b = resolve(r.category_id);
    if (b === undefined) outsidePlanned += r.draft;
    else planned.set(b.id, (planned.get(b.id) ?? 0) + r.draft);
  }
  return {
    buckets: buckets.map((b, i) => ({
      id: b.id,
      name: b.name,
      shareBp: b.share_bp,
      measure: measureOf(b),
      target: targets?.[i],
      planned:
        (planned.get(b.id) ?? 0) +
        (b.takes_savings ? savings : 0) +
        (b.takes_goals ? goalDeposits : 0),
      spent: b.spent.amount,
    })),
    outsidePlanned,
    rows: outsideRows(buckets, movements),
  };
}

// The rows of A258: a figure enters when it is above zero and no bucket takes it. No bucket
// takes the installments.
export function outsideRows(
  buckets: readonly Pick<Bucket, "takes_savings" | "takes_goals">[],
  movements: PlanMovements,
): OutsideRow[] {
  const taken = {
    installments: false,
    savings: buckets.some((b) => b.takes_savings),
    goalDeposits: buckets.some((b) => b.takes_goals),
  };

  return (["installments", "savings", "goalDeposits"] as const)
    .filter((key) => movements[key] > 0 && !taken[key])
    .map((key) => ({ key, amount: movements[key] }));
}

// The rows of the plan table under their bucket in method order, then the rows outside the
// method; a line carries its full category path, since a bucket mixes roots.
export function bucketGroups(
  buckets: readonly Bucket[],
  entries: readonly CategoryEntry[],
  rows: readonly PlanDraftRow[],
  outsideName: string,
): PlanGroup[] {
  const resolve = bucketResolver(buckets, entries);
  const byCategory = new Map(rows.map((r) => [r.category_id, r]));
  const empty = (id: string, name: string): PlanGroup => ({
    id,
    name,
    lines: [],
    draft: 0,
    lastMonth: 0,
    average: 0,
  });
  const groups = new Map(buckets.map((b) => [b.id, empty(b.id, b.name)]));
  const outside = empty(outsideBucket, outsideName);
  for (const entry of entries) {
    const row = byCategory.get(entry.id);
    if (row === undefined) continue;
    const id = resolve(entry.id)?.id;
    const group = (id === undefined ? undefined : groups.get(id)) ?? outside;
    const line: PlanLine = { row, entry, label: entry.path };
    group.lines.push(line);
    if (!row.counted) continue;
    group.draft += row.draft;
    group.lastMonth += row.last_month.amount;
    group.average += row.average.amount;
  }
  const filled = [...groups.values()].filter((g) => g.lines.length > 0);
  return outside.lines.length === 0 ? filled : [...filled, outside];
}

export interface BucketStatus {
  kind: "toPlan" | "over" | "above";
  amount: number;
}

// What a bucket's target still leaves to plan, or how far the plan passes it; undefined
// without a target (income buckets spec 5, Plan).
export function bucketStatus(
  target: number | undefined,
  planned: number,
  measure: BucketMeasure,
): BucketStatus | undefined {
  if (target === undefined) return undefined;
  if (planned > target)
    return {
      kind: measure === "ceiling" ? "over" : "above",
      amount: planned - target,
    };
  return { kind: "toPlan", amount: target - planned };
}
