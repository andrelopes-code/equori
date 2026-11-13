import { numberFormatter } from "@/i18n/format";
import type { TFunction } from "@/i18n/i18n-provider";

// KC6: "1 account" or "{count} accounts", the number through numberFormatter. Covers 1 and above;
// each caller writes its own text at zero.
export function kindCountText(
  t: TFunction,
  tag: string,
  count: number,
): string {
  if (count === 1) return t("kindPanel.countOne");

  return t("kindPanel.countMany", {
    count: numberFormatter(tag).format(count),
  });
}
