import { bpFromText } from "@/features/planning/budget-plan/plan-math";
import { totalBp } from "@/features/planning/income-split/bucket-draft";
import type { DraftBucket } from "@/features/planning/income-split/bucket-draft";

const whole = 10_000;

// The colour of a bucket on the data palette of eight, by its number.
export function potColor(number: number): number {
  return ((number - 1) % 8) + 1;
}

export interface BarSegment {
  key: string;
  // The position of the bucket in the split, from one.
  number: number;
  bp: number;
}

export interface SplitBar {
  segments: BarSegment[];
  // The share no bucket takes, in basis points.
  rest: number;
}

export type SumState =
  | { kind: "whole" }
  | { kind: "missing" | "over"; total: number; off: number }
  | { kind: "invalid" };

// The split as one bar (dialog spec A249): a segment per bucket and the missing share. A share
// that is not a number draws nothing.
export function splitBar(buckets: readonly DraftBucket[]): SplitBar {
  const segments = buckets.map((b, i) => ({
    key: b.key,
    number: i + 1,
    bp: bpFromText(b.share) ?? 0,
  }));
  const total = segments.reduce((sum, s) => sum + s.bp, 0);

  return { segments, rest: Math.max(0, whole - total) };
}

// How the shares sum against the whole (dialog spec A249).
export function sumState(buckets: readonly DraftBucket[]): SumState {
  const total = totalBp(buckets);
  if (total === undefined) return { kind: "invalid" };

  if (total === whole) return { kind: "whole" };

  return total < whole
    ? { kind: "missing", total, off: whole - total }
    : { kind: "over", total, off: total - whole };
}
