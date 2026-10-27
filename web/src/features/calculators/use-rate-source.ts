import { readRate } from "@/features/calculators/calculator-search";
import { readFloating } from "@/features/calculators/floating";
import type { Floating, FloatingKeys } from "@/features/calculators/floating";
import { rateText } from "@/features/calculators/format-rate";
import {
  annualToMonthly,
  monthlyToAnnual,
} from "@/features/calculators/rate-math";
import {
  useIndexes,
  useIndexRate,
} from "@/features/calculators/use-index-rate";
import type { Index } from "@/features/calculators/use-index-rate";
import type { RatePeriod } from "@/ui/rate-input";

export interface RateSource {
  // The address keys: the rate text, its period, the index, and how the rate follows it.
  keys: { rate: string; period: string; index: string };
  floatingKeys: FloatingKeys;
  daily: Index[];
  index: Index | undefined;
  floating: Floating;
  fromIndex: { rate: number; to: string } | null;
  // What the rate field shows: the typed text, or the annual rate taken from the index.
  text: string;
  period: RatePeriod;
  monthly: number | null;
  annual: number | null;
  noIndexes: boolean;
  // The horizon of the expected basis, in months (ADR 026 E8).
  months: number;
}

// A rate typed with its period, or an annual rate taken from a daily index (design §4, "Index
// basis"), at a percent of it or plus a spread (design §4, "Filled inputs").
export function useRateSource(
  search: Record<string, string>,
  rateKey: string,
  months = 12,
): RateSource {
  const keys = {
    rate: rateKey,
    period: `${rateKey}Period`,
    index: `${rateKey}Index`,
  };
  const floatingKeys = {
    form: `${rateKey}Form`,
    percent: `${rateKey}Percent`,
    spread: `${rateKey}Spread`,
    basis: `${rateKey}Basis`,
  };
  const indexes = useIndexes();
  const daily = indexes.filter((i) => i.period === "day");
  const index = daily.find((i) => i.id === search[keys.index]);
  const floating = readFloating(
    search,
    floatingKeys,
    index?.id ?? "",
    index?.expected ?? false,
  );
  const fromIndex = useIndexRate(index, floating, months);
  if (index !== undefined) {
    const annual = fromIndex?.rate ?? null;
    return {
      keys,
      floatingKeys,
      daily,
      index,
      floating,
      fromIndex,
      text: annual === null ? "" : rateText(annual),
      period: "year",
      monthly: annual === null ? null : annualToMonthly(annual),
      annual,
      noIndexes: indexes.length === 0,
      months,
    };
  }
  const period: RatePeriod = search[keys.period] === "month" ? "month" : "year";
  const typed = readRate(search[keys.rate]);
  const monthly =
    typed === null ? null : period === "month" ? typed : annualToMonthly(typed);
  return {
    keys,
    floatingKeys,
    daily,
    index,
    floating,
    fromIndex,
    text: search[keys.rate] ?? "",
    period,
    monthly,
    annual: monthly === null ? null : monthlyToAnnual(monthly),
    noIndexes: indexes.length === 0,
    months,
  };
}
