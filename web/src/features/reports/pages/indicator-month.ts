import { shiftMonth } from "@/features/overview";

// The month before the month of today: the tab opens on a complete month, whose savings rate
// compares with the others. The current month stays selectable (indicators tab design, D2).
export function defaultMonth(today: string): string {
  return shiftMonth(today.slice(0, 7), -1);
}
