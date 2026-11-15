import type { components } from "@/api/schema.gen";
import type { ShoppingEntry } from "@/features/portfolio/contribution-plan/model/shopping-list";
import { quantityText } from "@/features/portfolio/contribution-plan/model/quantity-text";
import type { TFunction } from "@/i18n/i18n-provider";
import { MASK } from "@/privacy/mask";

type Money = components["schemas"]["Money"];

export interface OrderWords {
  t: TFunction;
  money: (m: Money) => string;
  locale: string;
  // Privacy mode: the units are masked; money masks itself.
  hidden: boolean;
}

// How a purchase is bought (spec, Purchase list as one bar): units times the unit price, by
// value, or without a price. A group that waits for a split has no text: its row draws a link.
export function orderText(
  entry: ShoppingEntry,
  words: OrderWords,
): string | undefined {
  const { t, money, locale, hidden } = words;

  if (entry.byValue === true) return t("contributionPlan.byValue");

  if (entry.unpriced === true) return t("contributionPlan.unpriced");

  if (entry.quantity === undefined) return undefined;

  const count = hidden ? MASK : quantityText(entry.quantity, locale);

  if (entry.unit === undefined)
    return t("contributionPlan.quantity", { count });

  return t(orderKey(entry, hidden), {
    count,
    price: money(entry.unit),
    symbol: entry.symbol ?? "",
  });
}

// The plural is kept in privacy mode: a singular would tell the count.
function orderKey(entry: ShoppingEntry, hidden: boolean) {
  if (entry.symbol !== undefined) return "contributionPlan.orderSymbol";

  if (entry.quantity === "1" && !hidden) return "contributionPlan.orderOne";

  return "contributionPlan.orderMany";
}
