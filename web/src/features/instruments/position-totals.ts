import type { components } from "@/api/schema.gen";

type Position = components["schemas"]["Position"];
type Money = components["schemas"]["Money"];

export interface Result {
  amount: number;
  // The result over the cost; null when the cost is zero.
  bp: number | null;
}

export interface PositionTotals {
  quantity: Money;
  cost: Money;
  marketValue: Money | null;
  result: Result | null;
  // Why result is null: a position without a price, or a cost and a value in two currencies.
  blocked: "price" | "currency" | null;
  // The quantity-weighted mean of the average costs, in the cost currency; null unless every
  // position has one and the cost currency is the quote currency. It is drawn, never written.
  averageCost: number | null;
}

// The unrealized result of one position: its value minus its cost, when both are in one currency.
export function positionResult(p: Position): Result | null {
  if (p.market_value === undefined) return null;
  if (p.market_value.currency !== p.cost_basis.currency) return null;

  return resultOf(p.market_value.amount, p.cost_basis.amount);
}

// The sums of the positions of one instrument, or null without a position. A sum holds one
// currency: positions in two cost currencies are not added.
export function positionTotals(
  positions: readonly Position[],
  quote: string,
): PositionTotals | null {
  const first = positions[0];
  if (first === undefined) return null;

  const costCurrency = first.cost_basis.currency;
  const quantity: Money = {
    amount: sum(positions.map((p) => p.quantity.amount)),
    currency: first.quantity.currency,
  };
  const cost: Money = {
    amount: sum(positions.map((p) => p.cost_basis.amount)),
    currency: costCurrency,
  };
  const sameCost = positions.every(
    (p) => p.cost_basis.currency === costCurrency,
  );
  const marketValue = valueOf(positions);

  let blocked: PositionTotals["blocked"] = null;
  let result: Result | null = null;
  if (marketValue === null) blocked = "price";
  else if (!sameCost || marketValue.currency !== costCurrency)
    blocked = "currency";
  else result = resultOf(marketValue.amount, cost.amount);

  return {
    quantity,
    cost,
    marketValue,
    result,
    blocked,
    averageCost:
      sameCost && costCurrency === quote ? weighted(positions) : null,
  };
}

function resultOf(value: number, cost: number): Result {
  const amount = value - cost;

  return {
    amount,
    bp: cost === 0 ? null : Math.round((amount * 10000) / cost),
  };
}

function weighted(positions: readonly Position[]): number | null {
  let weight = 0;
  let total = 0;
  for (const p of positions) {
    if (p.average_cost === undefined) return null;
    weight += p.quantity.amount;
    total += Number(p.average_cost) * p.quantity.amount;
  }

  return weight > 0 ? total / weight : null;
}

function sum(amounts: readonly number[]): number {
  return amounts.reduce((total, amount) => total + amount, 0);
}

// The sum of the market values, or null when a position has no price or two currencies meet.
function valueOf(positions: readonly Position[]): Money | null {
  let amount = 0;
  let currency: string | undefined;
  for (const p of positions) {
    const value = p.market_value;
    if (value === undefined) return null;
    if (currency !== undefined && value.currency !== currency) return null;
    currency = value.currency;
    amount += value.amount;
  }

  return currency === undefined ? null : { amount, currency };
}
