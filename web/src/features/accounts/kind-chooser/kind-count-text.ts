import type { Kind } from "@/features/accounts/model/account-kinds";
import { numberFormatter } from "@/i18n/format";
import type { TFunction } from "@/i18n/i18n-provider";

// KC6: "1 account" or "{count} accounts", "1 card" or "{count} cards" for a credit card, the
// number through numberFormatter. Covers 1 and above; each caller writes its own text at zero.
export function kindCountText(
  t: TFunction,
  tag: string,
  count: number,
  kind: Kind,
): string {
  const card = kind === "credit_card";

  if (count === 1)
    return t(card ? "kindPanel.countOneCard" : "kindPanel.countOne");

  return t(card ? "kindPanel.countManyCard" : "kindPanel.countMany", {
    count: numberFormatter(tag).format(count),
  });
}
