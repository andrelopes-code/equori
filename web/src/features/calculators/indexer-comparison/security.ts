import type { IndexRate } from "@/features/calculators/rate-source/index-rates";

export type SecurityForm = "fixed" | "percent" | "spread";

export interface Security {
  form: SecurityForm;
  // Absent for fixed.
  index?: string;
  // The annual rate, the multiplier (1.4 for 140%) or the spread a year; null while not a number.
  rate: number | null;
  taxed: boolean;
}

// What the comparison knows of an index.
export interface IndexData {
  id: string;
  period: "day" | "month";
  rates: readonly IndexRate[];
  points: readonly IndexRate[];
  surveyDate: string;
  dailySpread: boolean;
}

const monthDays = 365.25 / 12;

export function horizonMonths(days: number): number {
  return Math.max(1, Math.ceil(days / monthDays));
}
