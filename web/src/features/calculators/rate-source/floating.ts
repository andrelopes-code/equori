import { readRate } from "@/features/calculators/model/calculator-search";
import { rateSourceChoices } from "@/features/calculators/rate-source/rate-source-keys";
import { quotedForm } from "@/features/calculators/rate-source/index-catalog";
import type { Basis } from "@/features/calculators/rate-source/index-rates";

// How a rate follows a daily index: a percent of each day's rate (110% of the CDI), or the
// index plus a spread a year (SOFR + 2%).
export type FloatingForm = "percent" | "spread";

export interface FloatingKeys {
  form: string;
  percent: string;
  spread: string;
  basis: string;
}

// The basis of the index's rate: a constant one (Basis), or the path a market survey expects
// (ADR 026), offered only for an index with expectations.
export type RateBasis = Basis | "expected";

export interface Floating {
  form: FloatingForm;
  text: string;
  // The percent as a multiplier (1.1 for 110%), or the spread as a fraction a year.
  value: number | null;
  basis: RateBasis;
}

// The basis a rate takes when the address names none (ADR 026 E9).
export function defaultBasis(expected: boolean): RateBasis {
  return expected ? "expected" : "current";
}

// The form named in the address; else the one whose value the address holds; else the one the
// index is quoted in. The basis named in the address, else the default of the index.
export function readFloating(
  search: Partial<Record<string, string>>,
  keys: FloatingKeys,
  indexId: string,
  expected = false,
): Floating {
  const named = rateSourceChoices.form.find((f) => f === search[keys.form]);
  const implied: FloatingForm =
    search[keys.percent] !== undefined
      ? "percent"
      : search[keys.spread] !== undefined
        ? "spread"
        : quotedForm(indexId);
  const form = named ?? implied;
  const text =
    form === "percent"
      ? (search[keys.percent] ?? "100")
      : (search[keys.spread] ?? "0");
  const namedBasis = search[keys.basis];
  const basis: RateBasis =
    namedBasis === "trailing" ||
    namedBasis === "current" ||
    (namedBasis === "expected" && expected)
      ? namedBasis
      : defaultBasis(expected);
  return { form, text, value: readRate(text), basis };
}

export const floatingKeys: FloatingKeys = {
  form: "form",
  percent: "percent",
  spread: "spread",
  basis: "basis",
};

// The address change that forgets how a rate followed an index.
export function clearFloating(
  keys: FloatingKeys,
): Record<string, string | undefined> {
  return {
    [keys.form]: undefined,
    [keys.percent]: undefined,
    [keys.spread]: undefined,
    [keys.basis]: undefined,
  };
}

// The factor of a stored day of an index at a percent or a spread (ADR 026 E7), from the index's
// daily rate d and the n stored days of its year, as expectedOverDaily takes it. A spread adds
// its 360th to each day of an actual/360 index; otherwise it compounds over the n days.
export function perDayOf(
  form: FloatingForm,
  value: number,
  dailySpread: boolean,
): (d: number, n: number) => number {
  if (form === "percent") return (d) => 1 + value * d;
  if (dailySpread) return (d) => 1 + d + value / 360;
  return (d, n) => (1 + d) * (1 + value) ** (1 / n);
}
