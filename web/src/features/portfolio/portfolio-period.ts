import { shiftDate } from "@/i18n/format";

// The longest period getReturn accepts, in days between its two ends.
const maxDays = 366;

function utc(iso: string): number {
  const [year = 0, month = 1, day = 1] = iso.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

// The first day of the 12 months that end on `to`.
export function defaultFrom(to: string): string {
  const [year = 0, month = 1, day = 1] = to.split("-").map(Number);
  const back = new Date(Date.UTC(year - 1, month - 1, day));
  return shiftDate(back.toISOString().slice(0, 10), 1);
}

export function periodProblem(
  from: string,
  to: string,
): "reversed" | "tooLong" | undefined {
  const days = (utc(to) - utc(from)) / 86_400_000;
  if (days < 0) return "reversed";
  return days > maxDays ? "tooLong" : undefined;
}
