// A rate of an index as a fraction, dated as GET /indexes/{id}/rates dates it.
export interface IndexRate {
  date: string;
  rate: number;
}

// The product of (1 + rate) over the rates, minus 1.
export function accumulated(rates: readonly IndexRate[]): number {
  return rates.reduce((p, r) => p * (1 + r.rate), 1) - 1;
}

// The same day a year earlier; February 29 becomes February 28.
function yearBefore(date: string): string {
  const year = String(Number(date.slice(0, 4)) - 1).padStart(4, "0");
  const monthDay = date.slice(5);
  return `${year}-${monthDay === "02-29" ? "02-28" : monthDay}`;
}

// The rates of a daily index after the last stored date minus one year, up to it (design §4);
// null when the stored rates start after that date.
function trailingYear(rates: readonly IndexRate[]): IndexRate[] | null {
  const first = rates.at(0);
  const last = rates.at(-1);
  if (first === undefined || last === undefined) return null;
  const start = yearBefore(last.date);
  if (first.date > start) return null;
  return rates.filter((r) => r.date > start);
}

export function trailingDaily(rates: readonly IndexRate[]): number | null {
  const year = trailingYear(rates);
  return year === null ? null : accumulated(year);
}

// The product over the last 12 stored months, minus 1; null with fewer than 12.
export function trailingMonthly(rates: readonly IndexRate[]): number | null {
  return rates.length < 12 ? null : accumulated(rates.slice(-12));
}

// The annual rate of a percent of a daily index: 1.1 is 110% of each day's rate.
export function percentOfDaily(
  rates: readonly IndexRate[],
  multiplier: number,
): number | null {
  const year = trailingYear(rates);
  return year === null
    ? null
    : year.reduce((p, r) => p * (1 + multiplier * r.rate), 1) - 1;
}

// The annual rate of a daily index plus a spread a year: added as its 360th to each stored day
// when the index stores calendar days on an actual/360 basis, compounded with the index's year
// otherwise ((1 + index) × (1 + spread) − 1).
export function spreadOverDaily(
  rates: readonly IndexRate[],
  spread: number,
  perDay: boolean,
): number | null {
  const year = trailingYear(rates);
  if (year === null) return null;
  return perDay
    ? year.reduce((p, r) => p * (1 + r.rate + spread / 360), 1) - 1
    : (1 + accumulated(year)) * (1 + spread) - 1;
}
