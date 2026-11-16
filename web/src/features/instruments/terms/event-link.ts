import type { components } from "@/api/schema.gen";

type FixedIncomeEvent = components["schemas"]["FixedIncomeEvent"];

const unitPriceDecimals = 12;

// The URL of the entry form that records the event: a coupon income for an interest, a sale for
// an amortization or a maturity (FC20).
export function recordLink(
  event: FixedIncomeEvent,
  scale: (code: string) => number,
): string {
  return `/transactions/new?${new URLSearchParams(recordSearch(event, scale))}`;
}

// The presets of the entry route, in the order the link writes them.
export function recordSearch(
  event: FixedIncomeEvent,
  scale: (code: string) => number,
): Record<string, string> {
  const { gross } = event;

  if (event.kind === "interest") {
    return {
      kind: "investment_income",
      account_id: event.account_id,
      income_type: "coupon",
      date: event.date,
      ...(gross === undefined ? {} : { gross: String(gross.amount) }),
    };
  }

  return {
    kind: "trade",
    side: "sell",
    account_id: event.account_id,
    quantity: String(event.quantity.amount),
    ...(gross === undefined || event.quantity.amount === 0
      ? {}
      : { unit_price: unitPrice(gross, event.quantity, scale) }),
    date: event.date,
  };
}

// Gross divided by units, as decimal text at 12 decimals, half up.
function unitPrice(
  gross: FixedIncomeEvent["quantity"],
  quantity: FixedIncomeEvent["quantity"],
  scale: (code: string) => number,
): string {
  const numerator =
    BigInt(gross.amount) *
    10n ** BigInt(scale(quantity.currency) + unitPriceDecimals);
  const denominator =
    BigInt(quantity.amount) * 10n ** BigInt(scale(gross.currency));
  const digits = ((2n * numerator + denominator) / (2n * denominator))
    .toString()
    .padStart(unitPriceDecimals + 1, "0");
  const cut = digits.length - unitPriceDecimals;

  return `${digits.slice(0, cut)}.${digits.slice(cut)}`;
}
