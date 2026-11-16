interface NextDatesRecurrence {
  frequency: string;
  interval: number;
  day?: number;
}

const DEFAULT_COUNT = 6;

// Calendar arithmetic on YYYY-MM-DD text: no time zone and no clock.
export function nextDates(
  start: string,
  recurrence: NextDatesRecurrence,
  count: number = DEFAULT_COUNT,
): string[] {
  if (recurrence.frequency !== "monthly" || recurrence.interval < 1) {
    return [];
  }

  const year = Number(start.slice(0, 4));
  const month = Number(start.slice(5, 7)) - 1;
  const day = recurrence.day ?? Number(start.slice(8, 10));

  return Array.from({ length: count }, (_, index) =>
    nominalDate(year, month + index * recurrence.interval, day),
  );
}

function nominalDate(year: number, monthIndex: number, day: number): string {
  const shiftedYear = year + Math.floor(monthIndex / 12);
  const month = (((monthIndex % 12) + 12) % 12) + 1;
  const lastDay = new Date(Date.UTC(shiftedYear, month, 0)).getUTCDate();

  return `${pad(shiftedYear, 4)}-${pad(month, 2)}-${pad(Math.min(day, lastDay), 2)}`;
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}
