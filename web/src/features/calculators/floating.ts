import { readRate } from "@/features/calculators/calculator-search";
import { quotedForm } from "@/features/calculators/index-catalog";
import type { Basis } from "@/features/calculators/index-rates";

// How a rate follows a daily index: a percent of each day's rate (110% of the CDI), or the
// index plus a spread a year (SOFR + 2%).
export type FloatingForm = "percent" | "spread";

export interface FloatingKeys {
  form: string;
  percent: string;
  spread: string;
  basis: string;
}

export interface Floating {
  form: FloatingForm;
  text: string;
  // The percent as a multiplier (1.1 for 110%), or the spread as a fraction a year.
  value: number | null;
  basis: Basis;
}

// The form named in the address; else the one whose value the address holds; else the one the
// index is quoted in.
export function readFloating(
  search: Record<string, string>,
  keys: FloatingKeys,
  indexId: string,
): Floating {
  const named = search[keys.form];
  const form: FloatingForm =
    named === "percent" || named === "spread"
      ? named
      : search[keys.percent] !== undefined
        ? "percent"
        : search[keys.spread] !== undefined
          ? "spread"
          : quotedForm(indexId);
  const text =
    form === "percent"
      ? (search[keys.percent] ?? "100")
      : (search[keys.spread] ?? "0");
  const basis = search[keys.basis] === "trailing" ? "trailing" : "current";
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
