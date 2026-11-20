import type { ViewPayload } from "@/features/assistant/view/view-types";

// The symbol of the first amount among a view's rows: the label of the amount side of its unit switch.
export function currencySymbol(
  p: ViewPayload,
  locale: string,
): string | undefined {
  const money = p.rows.rows.flat().find((v) => v.money !== undefined)?.money;
  if (money === undefined) return undefined;

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: money.currency,
  })
    .formatToParts(0)
    .find((part) => part.type === "currency")?.value;
}
