import { readInt } from "@/features/calculators/calculator-search";

export type DurationUnit = "day" | "month" | "year";

const decimalPattern = /^\d+(\.\d+)?$/;

export function readUnit(
  v: string | undefined,
  units: readonly DurationUnit[],
): DurationUnit {
  return units.find((u) => u === v) ?? units[0] ?? "month";
}

// Months from the text typed in a unit: a year is 12 months, and a fraction of a year counts
// only when it is a whole number of months (1.5 years is 18 months; 1.3 years is no term).
export function readMonths(
  text: string | undefined,
  unit: DurationUnit,
  min: number,
  max: number,
): number | null {
  if (unit !== "year") return readInt(text, min, max);
  if (text === undefined || !decimalPattern.test(text)) return null;
  const months = Number(text) * 12;
  const whole = Math.round(months);
  if (Math.abs(months - whole) > 1e-9) return null;
  return whole >= min && whole <= max ? whole : null;
}

// Calendar days from today to the same day a whole number of months or years later; a day
// past the end of the target month falls on its last day (31 January plus a month is 28 or 29
// February).
export function readDays(
  text: string | undefined,
  unit: DurationUnit,
  today: string,
  max: number,
): number | null {
  if (unit === "day") return readInt(text, 1, max);
  const n = readInt(text, 1, max);
  if (n === null) return null;
  const [y = 0, m = 1, d = 1] = today.split("-").map(Number);
  const total = m - 1 + (unit === "year" ? n * 12 : n);
  const year = y + Math.floor(total / 12);
  const month = total % 12;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const days =
    (Date.UTC(year, month, Math.min(d, last)) - Date.UTC(y, m - 1, d)) /
    86_400_000;
  return days <= max ? days : null;
}

// The text of a duration in another unit, when it converts exactly; otherwise the text as it
// was, so a switch of unit never invents a figure the reader did not type.
export function convertMonthsText(
  text: string,
  from: DurationUnit,
  to: DurationUnit,
): string {
  if (from === to || !decimalPattern.test(text)) return text;
  const n = Number(text);
  if (from === "month" && to === "year")
    return Number.isInteger(n) && n % 12 === 0 ? String(n / 12) : text;
  if (from === "year" && to === "month") {
    const months = n * 12;
    return Number.isInteger(months) ? String(months) : text;
  }
  return text;
}

export const termUnits: readonly DurationUnit[] = ["month", "year"];

// The address change of a switch of unit: the unit, left out when it is the first of units,
// and the typed text converted when it converts exactly. Days do not convert to months or
// years without a calendar, so a switch to or from days clears the text.
export function unitPatch(
  name: string,
  text: string | undefined,
  from: DurationUnit,
  to: DurationUnit,
  units: readonly DurationUnit[] = termUnits,
): Record<string, string | undefined> {
  return {
    [`${name}Unit`]: to === units[0] ? undefined : to,
    [name]:
      text === undefined || (from !== to && (from === "day" || to === "day"))
        ? undefined
        : convertMonthsText(text, from, to),
  };
}
