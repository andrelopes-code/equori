function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function addMonths(month: string, delta: number): string {
  const [year = 0, m = 1] = month.split("-").map(Number);
  const index = year * 12 + (m - 1) + delta;
  return `${String(Math.floor(index / 12))}-${pad((index % 12) + 1)}`;
}

export function currentMonth(today: string): string {
  return today.slice(0, 7);
}

export function monthRange(
  center: string,
  before: number,
  after: number,
): string[] {
  return Array.from({ length: before + after + 1 }, (_, i) =>
    addMonths(center, i - before),
  );
}
