import { shiftMonth } from "@/features/overview";

// The slider runs from 50 to 5 000 major units in steps of 50.
export const monthlyRange = { min: 50, max: 5000, step: 50 } as const;

function monthsBetween(from: string, to: string): number {
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
