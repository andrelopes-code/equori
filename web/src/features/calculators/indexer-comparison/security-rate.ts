import type {
  IndexData,
  Security,
} from "@/features/calculators/indexer-comparison/security";
import { perDayOf } from "@/features/calculators/rate-source/floating";
import {
  expectedOverDaily,
  expectedOverMonthly,
  trailingYear,
} from "@/features/calculators/rate-source/index-rates";

// IC2: the annual rate under the expected path; null when data is missing.
export function expectedRate(
  s: Security,
  data: IndexData | undefined,
  months: number,
): number | null {
  if (s.form === "fixed") return s.rate;
  if (data === undefined || s.rate === null) return null;
  if (data.period === "day")
    return expectedOverDaily(
      data.rates,
      data.points,
      months,
      perDayOf(s.form, s.rate, data.dailySpread),
    );
  if (s.form !== "spread") return null;
  const index = expectedOverMonthly(data.rates, data.points, months);
  return index === null ? null : (1 + index) * (1 + s.rate) - 1;
}

// IC4: the annual rate with the index constant at x.
export function rateAtIndex(
  s: Security,
  data: IndexData,
  x: number,
): number | null {
  if (s.form === "fixed") return s.rate;
  if (s.rate === null) return null;
  if (data.period === "month")
    return s.form === "spread" ? (1 + x) * (1 + s.rate) - 1 : null;
  const year = trailingYear(data.rates);
  if (year === null) return null;
  const n = year.length;
  const d = (1 + x) ** (1 / n) - 1;
  return perDayOf(s.form, s.rate, data.dailySpread)(d, n) ** n - 1;
}

// IC5: the annual rate of 100% of the index under its expected path.
export function expectedIndexRate(
  data: IndexData,
  months: number,
): number | null {
  if (data.period === "month")
    return expectedOverMonthly(data.rates, data.points, months);
  return expectedOverDaily(data.rates, data.points, months, (d) => 1 + d);
}
