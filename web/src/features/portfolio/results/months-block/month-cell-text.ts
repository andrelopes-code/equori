import { numberFormatter } from "@/i18n/format";

// A month outside the history, or outside the index under a comparison.
export const emptyCell = "–";

// A return as a percent number with two decimals and no percent sign: the caption carries the unit.
export function monthCellText(fraction: number, tag: string): string {
  return numberFormatter(tag, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "negative",
  }).format(fraction * 100);
}
