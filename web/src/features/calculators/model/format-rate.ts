import { numberFormatter } from "@/i18n/format";

// A rate as a percentage of the locale with up to 4 decimals (design §3): 0.126825 reads
// "12.6825%" in en-US. A CET passes 2 decimals, fixed.
export function formatRate(
  fraction: number,
  locale: string,
  decimals: { min?: number; max?: number } = {},
): string {
  return numberFormatter(locale, {
    style: "percent",
    minimumFractionDigits: decimals.min ?? 0,
    maximumFractionDigits: decimals.max ?? 4,
  }).format(fraction);
}

// A percent as typed in a rate field: 0.126825 becomes "12.6825".
export function rateText(fraction: number): string {
  return String(Number((fraction * 100).toFixed(4)));
}
