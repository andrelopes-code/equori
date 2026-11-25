// PX4, PX6: the months the projection runs: from the month after today to the birth month of the
// last age, and the month withdrawals start (the birth month of the withdrawal age).
export interface JourneyMonths {
  months: string[];
  withdrawalFrom: string;
}

export function journeyMonths(
  today: string,
  birthDate: string,
  withdrawalAge: number,
  lastAge: number,
): JourneyMonths {
  const [ty = 0, tm = 0] = today.split("-").map(Number);
  const [by = 0, bm = 0] = birthDate.split("-").map(Number);
  const first = ty * 12 + tm;
  const last = (by + lastAge) * 12 + bm - 1;
  const count = Math.max(last - first + 1, 0);

  return {
    months: Array.from({ length: count }, (_, i) => labelOf(first + i)),
    withdrawalFrom: labelOf((by + withdrawalAge) * 12 + bm - 1),
  };
}

// The last day of a `YYYY-MM` month, `YYYY-MM-DD`.
export function monthEnd(month: string): string {
  const [y = 0, m = 0] = month.split("-").map(Number);

  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

// A month counted from year 0 (`year * 12 + month - 1`) as `YYYY-MM`.
function labelOf(index: number): string {
  const month = String((index % 12) + 1).padStart(2, "0");

  return `${String(Math.floor(index / 12))}-${month}`;
}
