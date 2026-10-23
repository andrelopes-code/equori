import { shiftMonth } from "@/features/overview";

// The slider runs from 50 to 5 000 major units in steps of 50.
export const monthlyRange = { min: 50, max: 5000, step: 50 } as const;

export function monthsBetween(from: string, to: string): number {
  const [fy = 0, fm = 1] = from.split("-").map(Number);
  const [ty = 0, tm = 1] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

// The month the remainder is covered at the monthly amount.
export function completionMonth(
  today: string,
  remaining: number,
  monthly: number,
): string | null {
  const month = today.slice(0, 7);
  if (remaining <= 0) return month;
  if (monthly <= 0) return null;
  return shiftMonth(month, Math.ceil(remaining / monthly));
}

// The amount per month that covers the remainder by the due month, on the slider's grid.
// unit is one major unit in minor units, 10^scale.
export function defaultMonthly(
  today: string,
  due: string,
  remaining: number,
  unit = 100,
): number {
  const step = monthlyRange.step * unit;
  const months = Math.max(1, monthsBetween(today.slice(0, 7), due.slice(0, 7)));
  const raw = Math.ceil(remaining / months);
  return Math.min(
    monthlyRange.max * unit,
    Math.max(step, Math.ceil(raw / step) * step),
  );
}

// A century of months: past it the goal is not reachable at the amounts given.
const horizon = 1200;

// The month the balance reaches its target when it earns annualPercent a year and receives the
// monthly amount at each month's end. The projection is an estimate shown beside the exact
// figures, so it runs in floating point and rounds each month to a minor unit.
export function completionWithReturn(
  today: string,
  remaining: number,
  monthly: number,
  annualPercent: number,
  current = 0,
): string | null {
  if (annualPercent === 0) return completionMonth(today, remaining, monthly);
  const month = today.slice(0, 7);
  if (remaining <= 0) return month;
  const target = current + remaining;
  const rate = (1 + annualPercent / 100) ** (1 / 12) - 1;
  let balance = current;
  for (let n = 1; n <= horizon; n++) {
    balance = Math.round(balance * (1 + rate)) + monthly;
    if (balance >= target) return shiftMonth(month, n);
  }
  return null;
}
