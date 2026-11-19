import type { Debt } from "@/features/calculators/debt-payoff-calculator/debt-math";
import type { DebtRow } from "@/features/calculators/debt-payoff-calculator/debt-rows";
import { monthlyDebtRate } from "@/features/calculators/debt-payoff-calculator/debt-region";
import {
  readMinor,
  readRate,
} from "@/features/calculators/model/calculator-search";
import type { RatePeriod } from "@/ui/money/rate-input";

// The rows as debts with a monthly rate; null while no row exists or any row is incomplete.
export function readDebts(
  rows: readonly DebtRow[],
  period: RatePeriod,
  nominal: boolean,
): Debt[] | null {
  if (rows.length === 0) return null;

  const debts: Debt[] = [];
  for (const r of rows) {
    const balance = readMinor(r.balance);
    const rate = readRate(r.rate);
    const minimum = readMinor(r.minimum);
    if (balance === null || rate === null || rate < 0 || minimum === null)
      return null;
    debts.push({
      name: r.name,
      balance,
      rate: monthlyDebtRate(rate, period, nominal),
      minimum,
    });
  }

  return debts;
}
