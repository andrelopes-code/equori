export interface Maturity {
  state: "upcoming" | "running" | "matured";
  // The elapsed share of the term, 0 to 100.
  percent: number;
  elapsedDays: number;
  totalDays: number;
  // Days to maturity while the term runs or has not begun; days since maturity once it ended.
  days: number;
}

// The term of a fixed-income title in calendar days of the book's calendar (T1); the three dates
// are ISO calendar dates.
export function maturityOf(
  issuedOn: string,
  maturesOn: string,
  today: string,
): Maturity {
  const totalDays = daysBetween(issuedOn, maturesOn);
  const sinceIssue = daysBetween(issuedOn, today);
  const toMaturity = daysBetween(today, maturesOn);
  const elapsedDays = Math.min(Math.max(sinceIssue, 0), totalDays);
  const state =
    toMaturity <= 0 ? "matured" : sinceIssue < 0 ? "upcoming" : "running";

  return {
    state,
    percent:
      totalDays === 0 ? 100 : Math.round((elapsedDays * 100) / totalDays),
    elapsedDays,
    totalDays,
    days: Math.abs(toMaturity),
  };
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}
