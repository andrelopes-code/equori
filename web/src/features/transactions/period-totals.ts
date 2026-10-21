import type { TransactionRow } from "@/features/transactions/transaction-row";

export interface PeriodTotals {
  currency: string;
  // Minor units: income is at least zero, expense at most zero.
  income: number;
  expense: number;
}

// Transfers move money between the reader's own accounts and voided entries never happened; a
// sum across currencies has no meaning, so mixed rows give no totals.
export function periodTotals(
  rows: readonly Pick<TransactionRow, "money" | "transfer" | "voided">[],
): PeriodTotals | null {
  const counted = rows.filter((r) => !r.transfer && !r.voided);
  const [first] = counted;
  if (first === undefined) return null;
  const currency = first.money.currency;
  if (counted.some((r) => r.money.currency !== currency)) return null;
  let income = 0;
  let expense = 0;
  for (const r of counted) {
    if (r.money.amount > 0) income += r.money.amount;
    else expense += r.money.amount;
  }
  return { currency, income, expense };
}
