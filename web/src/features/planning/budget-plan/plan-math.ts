import type { components } from "@/api/schema.gen";

type BudgetPlanRow = components["schemas"]["BudgetPlanRow"];

// A plan row with the amount the screen holds for it, in minor units.
export type PlanDraftRow = BudgetPlanRow & { draft: number };

// Basis points of a whole.
const whole = 10_000n;

// Half up for the non-negative quotients the plan divides.
function divide(numerator: bigint, denominator: bigint): bigint {
  return (numerator * 2n + denominator) / (denominator * 2n);
}

// Splits total into parts proportional to weights whose sum is exactly total (budget plan
// A132): each part takes its floor, and the units left go to the largest remainders, the
// earlier position first. The arithmetic runs on BigInt, so no amount passes through a float.
export function largestRemainder(
  total: number,
  weights: readonly number[],
): number[] {
  const sum = weights.reduce((a, w) => a + BigInt(Math.max(w, 0)), 0n);
  if (total <= 0 || sum === 0n) return weights.map(() => 0);
  const t = BigInt(total);
  const parts = weights.map((w) => {
    const product = t * BigInt(Math.max(w, 0));
    return { floor: product / sum, rest: product % sum };
  });
  let left = t - parts.reduce((a, p) => a + p.floor, 0n);
  const order = parts
    .map((p, i) => ({ rest: p.rest, i }))
    .sort((a, b) => (a.rest === b.rest ? a.i - b.i : a.rest > b.rest ? -1 : 1));
  const out = parts.map((p) => p.floor);
  for (const { i } of order) {
    if (left === 0n) break;
    out[i] = (out[i] ?? 0n) + 1n;
    left -= 1n;
  }
  return out.map(Number);
}

// Scales the proposed amounts down to room when their sum passes it.
export function fitToRoom(
  proposed: ReadonlyMap<string, number>,
  room: number,
): Map<string, number> {
  const values = [...proposed.values()];
  if (values.reduce((a, v) => a + v, 0) <= room) return new Map(proposed);
  const parts = largestRemainder(Math.max(room, 0), values);
  return new Map([...proposed.keys()].map((k, i) => [k, parts[i] ?? 0]));
}

// An amount as basis points of the reference; undefined without a reference above zero.
export function planShare(
  amount: number,
  reference: number,
): number | undefined {
  if (reference <= 0) return undefined;
  const bp = divide(BigInt(Math.abs(amount)) * whole, BigInt(reference));
  return Number(amount < 0 ? -bp : bp);
}

// Basis points of the reference as an amount in minor units.
export function fromShare(bp: number, reference: number): number {
  if (bp <= 0 || reference <= 0) return 0;
  return Number(divide(BigInt(reference) * BigInt(bp), whole));
}

// The suggested amount of each row whose basis differs from its draft; a row with both at
// zero proposes nothing.
export function suggestion(
  rows: readonly PlanDraftRow[],
  basis: "average" | "last_month",
): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) {
    const value = Math.max(r[basis].amount, 0);
    if (value !== r.draft) out.set(r.category_id, value);
  }
  return out;
}

export interface PlanBase {
  reference: number | undefined;
  installments: number;
  savings: number;
}

// The counted drafts and what the reference leaves after them and the commitments.
export function planTotals(
  rows: readonly PlanDraftRow[],
  base: PlanBase,
): { planned: number; unassigned: number | undefined } {
  const planned = rows.reduce((a, r) => a + (r.counted ? r.draft : 0), 0);
  return {
    planned,
    unassigned:
      base.reference === undefined
        ? undefined
        : base.reference - base.installments - base.savings - planned,
  };
}

// A percent typed with a point or a comma and at most two decimals, as basis points; an empty
// text is zero, anything else undefined. String arithmetic only (O7).
export function bpFromText(text: string): number | undefined {
  const match = /^(\d*)(?:[.,](\d{0,2}))?$/.exec(text.trim());
  if (match === null) return undefined;
  const whole = match[1] ?? "";
  const fraction = (match[2] ?? "").padEnd(2, "0");
  return Number(whole === "" ? "0" : whole) * 100 + Number(fraction);
}

// Basis points as the percent a field shows: "12.5" for 1250.
export function textFromBp(bp: number): string {
  const whole = Math.trunc(bp / 100);
  const fraction = String(bp % 100)
    .padStart(2, "0")
    .replace(/0+$/, "");
  return fraction === "" ? String(whole) : `${String(whole)}.${fraction}`;
}
