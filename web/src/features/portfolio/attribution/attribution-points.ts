import { numberFormatter } from "@/i18n/format";
import type { TFunction } from "@/i18n/i18n-provider";

// A contribution in percentage points with its sign: 150 bp reads "+1,50 p.p." in pt-BR (AT9).
export function pointsText(bp: number, tag: string, t: TFunction): string {
  const value = numberFormatter(tag, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "exceptZero",
  }).format(bp / 100);

  return t("portfolio.attribution.points", { value });
}
