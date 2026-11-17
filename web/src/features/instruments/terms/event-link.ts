import type { components } from "@/api/schema.gen";

type FixedIncomeEvent = components["schemas"]["FixedIncomeEvent"];

const unitPriceDecimals = 12;

// The URL of the entry form that records the event: a coupon income for an interest, a sale for
// an amortization or a maturity, a unit tax for a fund (FC20).
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

  if (event.kind === "unit_tax") {
    return {
      kind: "corporate_action",
      action: "unit_tax",
      account_id: event.account_id,
      quantity: String(event.quantity.amount),
      date: event.date,
    };
  }

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

// Gross divided by units, as decimal text at 12 decimals, half to even (C1).
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
  const digits = halfEven(numerator, denominator)
    .toString()
    .padStart(unitPriceDecimals + 1, "0");
  const cut = digits.length - unitPriceDecimals;

  return `${digits.slice(0, cut)}.${digits.slice(cut)}`;
}

function halfEven(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  const twice = 2n * (numerator % denominator);

  if (twice > denominator || (twice === denominator && quotient % 2n === 1n))
    return quotient + 1n;

  return quotient;
}
