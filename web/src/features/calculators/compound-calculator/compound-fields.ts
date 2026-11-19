import {
  lowerFirst,
  missingSentence,
} from "@/features/calculators/calculator-frame/missing-fields";
import { rateText } from "@/features/calculators/model/format-rate";
import { annualToMonthly } from "@/features/calculators/model/rate-math";
import type { TFunction } from "@/i18n/i18n-provider";

interface EmptySentenceInput<K extends string> {
  // The inputs in reading order.
  order: readonly K[];
  labels: Record<K, string>;
  missing: Record<K, boolean>;
  // What the answer will show, after "to see".
  what: string;
  t: TFunction;
  tag: string;
}

// The sentence of an answer without a figure: the inputs still missing, in reading order; empty
// when none is missing.
export function emptySentence<K extends string>(
  input: EmptySentenceInput<K>,
): string {
  const fields = input.order.map((key) => ({
    label: lowerFirst(input.labels[key], input.tag),
    missing: input.missing[key],
  }));

  return missingSentence(fields, input.what, input.t, input.tag) ?? "";
}

// The text of a rate field: what is typed, or the rate an index fills in (empty while it loads).
export function indexedRateText(
  typed: string | undefined,
  indexed: boolean,
  fromIndex: { rate: number } | null,
): string {
  if (!indexed) return typed ?? "";

  return fromIndex === null ? "" : rateText(fromIndex.rate);
}

// A rate typed per month or per year as a monthly fraction; null without a rate.
export function monthlyRate(
  typed: number | null,
  period: "month" | "year",
): number | null {
  if (typed === null) return null;

  return period === "month" ? typed : annualToMonthly(typed);
}
