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

// Which rates of a daily index make its annual rate: the stored ones of the trailing year, or
// the last stored one repeated over the same days (design §4, "Index basis").
export type Basis = "current" | "trailing";

function yearOf(rates: readonly IndexRate[], basis: Basis): IndexRate[] | null {
  const year = trailingYear(rates);
  const last = rates.at(-1);
  if (year === null || last === undefined || basis === "trailing") return year;
  return year.map((r) => ({ date: r.date, rate: last.rate }));
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
  basis: Basis = "trailing",
): number | null {
  const year = yearOf(rates, basis);
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
  basis: Basis = "trailing",
): number | null {
  const year = yearOf(rates, basis);
  if (year === null) return null;
  return perDay
    ? year.reduce((p, r) => p * (1 + r.rate + spread / 360), 1) - 1
    : (1 + accumulated(year)) * (1 + spread) - 1;
}

const dayMs = 86_400_000;
const monthDays = 365.25 / 12;

// The expected annual rate of the index at a time (ADR 026 E6): linear from the current rate on
// the last stored date to each point, then the last point's rate.
function pathRate(
  start: number,
  current: number,
  points: readonly IndexRate[],
  at: number,
): number {
  let from = { t: start, rate: current };
  for (const p of points) {
    const t = Date.parse(`${p.date}T00:00:00Z`);
    if (t <= start) continue;
    if (at <= t)
      return from.rate + ((p.rate - from.rate) * (at - from.t)) / (t - from.t);
    from = { t, rate: p.rate };
  }
  return from.rate;
}

// The constant annual rate equivalent to the expected path over months (ADR 026 E7). Each month
// takes the path's rate at its middle as the rate of each stored day, d = (1 + rate)^(1/n) − 1
// with n the stored days of the trailing year; perDay(d, n) turns d into the factor of a stored
// day at the percent or the spread of the contract. Null when the stored rates cover less than a
// year.
export function expectedOverDaily(
  rates: readonly IndexRate[],
  points: readonly IndexRate[],
  months: number,
  perDay: (d: number, n: number) => number,
): number | null {
  const year = trailingYear(rates);
  const last = rates.at(-1);
  if (year === null || last === undefined || months < 1) return null;
  const n = year.length;
  const current = (1 + last.rate) ** n - 1;
  const start = Date.parse(`${last.date}T00:00:00Z`);
  let factor = 1;
  for (let k = 0; k < months; k++) {
    const rate = pathRate(
      start,
      current,
      points,
      start + (k + 0.5) * monthDays * dayMs,
    );
    factor *= perDay((1 + rate) ** (1 / n) - 1, n) ** (n / 12);
  }
  return factor ** (12 / months) - 1;
}
