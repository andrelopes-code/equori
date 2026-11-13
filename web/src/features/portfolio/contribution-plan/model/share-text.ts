import { numberFormatter } from "@/i18n/format";

// A share written as a percent: whole, with one decimal below 10%.
export function shareText(fraction: number, tag: string): string {
  const tenths = Math.round(fraction * 1000) / 10;
  const digits = tenths < 10 ? 1 : 0;

  return numberFormatter(tag, {
    style: "percent",
    maximumFractionDigits: digits,
  }).format(digits === 0 ? Math.round(tenths) / 100 : tenths / 100);
}
