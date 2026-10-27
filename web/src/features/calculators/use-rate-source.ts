import { readRate } from "@/features/calculators/calculator-search";
import { rateText } from "@/features/calculators/format-rate";
import {
  annualToMonthly,
  monthlyToAnnual,
} from "@/features/calculators/rate-math";
import {
  useIndexes,
  useTrailingRate,
} from "@/features/calculators/use-index-rate";
import type { Index } from "@/features/calculators/use-index-rate";
import type { RatePeriod } from "@/ui/rate-input";

export interface RateSource {
  // The address keys: the rate text, its period, the index and the percent of it.
  keys: { rate: string; period: string; index: string; percent: string };
  daily: Index[];
  index: Index | undefined;
  percentText: string;
  percent: number | null;
  fromIndex: { rate: number; to: string } | null;
  // What the rate field shows: the typed text, or the annual rate taken from the index.
  text: string;
  period: RatePeriod;
  monthly: number | null;
  annual: number | null;
  noIndexes: boolean;
}

// A rate typed with its period, or an annual rate taken from a percent of a daily index over
// its last 12 months (design §4, "Filled inputs").
export function useRateSource(
  search: Record<string, string>,
  rateKey: string,
): RateSource {
  const keys = {
    rate: rateKey,
    period: `${rateKey}Period`,
    index: `${rateKey}Index`,
    percent: `${rateKey}Percent`,
  };
  const indexes = useIndexes();
  const daily = indexes.filter((i) => i.period === "day");
  const index = daily.find((i) => i.id === search[keys.index]);
  const percentText = search[keys.percent] ?? "100";
  const percent = readRate(percentText);
  const fromIndex = useTrailingRate(
    percent === null ? undefined : index,
    percent ?? 1,
  );
  if (index !== undefined) {
    const annual = fromIndex?.rate ?? null;
    return {
      keys,
      daily,
      index,
      percentText,
      percent,
      fromIndex,
      text: annual === null ? "" : rateText(annual),
      period: "year",
      monthly: annual === null ? null : annualToMonthly(annual),
      annual,
      noIndexes: indexes.length === 0,
    };
  }
  const period: RatePeriod = search[keys.period] === "month" ? "month" : "year";
  const typed = readRate(search[keys.rate]);
  const monthly =
    typed === null ? null : period === "month" ? typed : annualToMonthly(typed);
  return {
    keys,
    daily,
    index,
    percentText,
    percent,
    fromIndex,
    text: search[keys.rate] ?? "",
    period,
    monthly,
    annual: monthly === null ? null : monthlyToAnnual(monthly),
    noIndexes: indexes.length === 0,
  };
}
