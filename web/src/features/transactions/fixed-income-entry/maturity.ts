// The ISO date `months` after `date`, on the last day of the month when that day does not exist.
export function monthsAfter(date: string, months: number): string {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  const target = year * 12 + (month - 1) + months;
  const y = Math.floor(target / 12);
  const m = target % 12;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

  return [y, m + 1, Math.min(day, last)]
    .map((n, i) => String(n).padStart(i === 0 ? 4 : 2, "0"))
    .join("-");
}
