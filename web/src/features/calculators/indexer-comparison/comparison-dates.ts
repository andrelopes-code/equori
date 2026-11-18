const msPerDay = 86_400_000;

// The same day `years` later; February 29 becomes February 28 in a year without one.
export function addYears(date: string, years: number): string {
  const year = Number(date.slice(0, 4)) + years;
  const monthDay = date.slice(5);
  const leap = new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1;

  return `${String(year).padStart(4, "0")}-${monthDay === "02-29" && !leap ? "02-28" : monthDay}`;
}

// The calendar days from one date to another.
export function daysBetween(from: string, to: string): number {
  return Math.round((dayNumber(to) - dayNumber(from)) / msPerDay);
}

// True when the date lies more than `days` days before today.
export function isOlderThan(
  date: string,
  today: string,
  days: number,
): boolean {
  return daysBetween(date, today) > days;
}

function dayNumber(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}
