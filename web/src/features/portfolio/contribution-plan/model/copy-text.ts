import type { components } from "@/api/schema.gen";
import { quantityText } from "@/features/portfolio/contribution-plan/model/quantity-text";
import type { ShoppingEntry } from "@/features/portfolio/contribution-plan/model/shopping-list";
import type { TFunction } from "@/i18n/i18n-provider";

type Money = components["schemas"]["Money"];

interface CopyTextContext {
  t: TFunction;
  locale: string;
  money: (m: Money) => string;
}

// The purchase list as plain text, one line per purchase and the leftover last.
export function copyText(
  entries: ShoppingEntry[],
  leftover: Money | undefined,
  { t, locale, money }: CopyTextContext,
): string {
  const lines = entries.map((entry) =>
    entry.quantity === undefined
      ? `${entry.name}  ${money(entry.cost)}`
      : `${entry.name}  ${t("contributionPlan.orderUnits", {
          count: quantityText(entry.quantity, locale),
          cost: money(entry.cost),
        })}`,
  );

  if (leftover !== undefined) {
    lines.push(t("contributionPlan.leftover", { amount: money(leftover) }));
  }

  return lines.join("\n");
}
