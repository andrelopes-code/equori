import type { components } from "@/api/schema.gen";

type Money = components["schemas"]["Money"];
type Position = components["schemas"]["Position"];

export interface RowTotal {
  // Gain plus the results of the sales plus the income; absent without a gain or a shared currency.
  total: number | undefined;
  // A part is in another currency than the cost, so no total is stated.
  outside: boolean;
}

export interface ResultTotals {
  realized: readonly Money[];
  income: readonly Money[];
}

export interface TotalFigure {
  value: number;
  realized: number;
  income: number;
  // The amounts of TR2 in another currency than the valuation, left out of value.
  outside: Money[];
}

// A262 TR3: a row adds its parts only when each one is in the currency of its cost.
export function rowTotal(
  gain: number | undefined,
  position: Position,
): RowTotal {
  const parts = [position.realized, position.income].filter(
    (m) => m !== undefined,
  );
  const outside = parts.some(
    (m) => m.currency !== position.cost_basis.currency,
  );

  if (gain === undefined || outside) return { total: undefined, outside };

  return {
    total: parts.reduce((sum, m) => sum + m.amount, gain),
    outside: false,
  };
}

// A262 TR4: the gain of the positions held plus every sale and income in the valuation currency.
export function totalFigure(
  gain: number,
  totals: ResultTotals,
  valueIn: string,
): TotalFigure {
  const inValuation = (amounts: readonly Money[]) =>
    amounts
      .filter((m) => m.currency === valueIn)
      .reduce((sum, m) => sum + m.amount, 0);
  const realized = inValuation(totals.realized);
  const income = inValuation(totals.income);

  return {
    value: gain + realized + income,
    realized,
    income,
    outside: [...totals.realized, ...totals.income].filter(
      (m) => m.currency !== valueIn,
    ),
  };
}
