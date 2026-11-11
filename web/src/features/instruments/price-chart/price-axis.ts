import { formatDayMonth, formatReferenceMonth } from "@/i18n/format";

// A223 RM6: above this many days the year is written, because a day and a month repeat.
const monthAxisFromDays = 100;

// A223 RM7: a marker on every price stops helping once the line is dense.
const maxMarkedPrices = 60;

export function axisLabel(
  value: number,
  locale: string,
  spanDays: number,
): string {
  const iso = new Date(value).toISOString().slice(0, 10);

  return spanDays > monthAxisFromDays
    ? formatReferenceMonth(iso.slice(0, 7), locale)
    : formatDayMonth(iso, locale);
}

// The part of a time domain a zoom leaves visible; start and end are fractions of the domain.
export function zoomedRange(
  first: number,
  last: number,
  zoom: { start: number; end: number },
): { first: number; last: number } {
  const span = last - first;

  return { first: first + span * zoom.start, last: first + span * zoom.end };
}

export function showMarkers(count: number): boolean {
  return count <= maxMarkedPrices;
}

// The most labels the time axis holds: seven stay apart on a 1,170 px plot with the year written.
const maxTicks = 7;

const day = 86_400_000;

// 1970-01-05 is a Monday; a step of days counts from it, so a step of 7 or 14 lands on Mondays.
const mondayEpoch = Date.UTC(1970, 0, 5);

const steps = [
  { unit: "day", size: 1 },
  { unit: "day", size: 2 },
  { unit: "day", size: 7 },
  { unit: "day", size: 14 },
  { unit: "month", size: 1 },
  { unit: "month", size: 2 },
  { unit: "month", size: 3 },
  { unit: "month", size: 6 },
  { unit: "year", size: 1 },
  { unit: "year", size: 2 },
  { unit: "year", size: 5 },
  { unit: "year", size: 10 },
  { unit: "year", size: 20 },
] as const;

// The label positions of a time axis from first to last, in UTC milliseconds: even steps on
// calendar boundaries (Mondays, first of the month, first of January), at most seven of them.
// The engine's own ticks mix a weekly step with the first of each month (F4).
export function axisTicks(first: number, last: number): number[] {
  if (last <= first) return [];

  let ticks: number[] = [];
  for (const step of steps) {
    ticks = ticksOf(step, first, last);
    if (ticks.length <= maxTicks) break;
  }

  return ticks;
}

function ticksOf(
  step: (typeof steps)[number],
  first: number,
  last: number,
): number[] {
  const ticks: number[] = [];
  if (step.unit === "day") {
    const size = step.size * day;
    for (
      let t = mondayEpoch + Math.ceil((first - mondayEpoch) / size) * size;
      t <= last;
      t += size
    )
      ticks.push(t);

    return ticks;
  }

  const start = new Date(first);
  const months = step.unit === "month" ? step.size : step.size * 12;
  let index = start.getUTCFullYear() * 12 + start.getUTCMonth();
  index = Math.ceil(index / months) * months;
  for (; ; index += months) {
    const t = Date.UTC(Math.floor(index / 12), index % 12, 1);
    if (t > last) break;
    if (t >= first) ticks.push(t);
  }

  return ticks;
}
