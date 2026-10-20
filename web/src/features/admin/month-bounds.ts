import { endOfMonth, parseISODate, toISODate } from "@slotted/core/date";

export function monthBounds(month: string): { from: string; to: string } {
  const first = parseISODate(`${month}-01`);
  if (first === null) return { from: "", to: "" };
  return { from: toISODate(first), to: toISODate(endOfMonth(first)) };
}
