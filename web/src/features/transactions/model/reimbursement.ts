import type { components } from "@/api/schema.gen";

type Account = components["schemas"]["Account"];
type Transaction = components["schemas"]["Transaction"];

export interface ReimbursementState {
  // The category side takes money in, so the transaction can repay an expense (A117).
  inflow: boolean;
  // Every category posting still sits on an uncategorized system account.
  uncategorized: boolean;
  // The amount that comes in on the category side, zero for an outflow.
  amount: number;
}

export function reimbursementState(
  tx: Transaction,
  accounts: ReadonlyMap<string, Account>,
): ReimbursementState {
  const categories = tx.postings.flatMap((p) => {
    const account = accounts.get(p.account_id);
    return account !== undefined &&
      (account.class === "income" || account.class === "expense")
      ? [{ account, amount: p.amount.amount }]
      : [];
  });
  const total = categories.reduce((sum, { amount }) => sum + amount, 0);
  if (total >= 0) return { inflow: false, uncategorized: false, amount: 0 };
  return {
    inflow: true,
    uncategorized: categories.every(
      ({ account }) =>
        account.system_role?.startsWith("uncategorized") === true,
    ),
    amount: -total,
  };
}

// What a row takes when it is checked: the rest of the inflow, up to what the expense still needs.
export function fillAllocation(remaining: number, unallocated: number): number {
  return Math.max(0, Math.min(remaining, unallocated));
}

export function allocationTotals(
  rows: readonly { checked: boolean; amount: number }[],
  inflow: number,
): { allocated: number; leftover: number } {
  const allocated = rows.reduce(
    (sum, row) => (row.checked ? sum + row.amount : sum),
    0,
  );
  return { allocated, leftover: inflow - allocated };
}

export interface ExpenseState {
  // The transaction holds an expense that an inflow can repay (A117).
  expense: boolean;
  // What the expense still needs: its expense category amounts minus what the inflows repay.
  remaining: number;
}

export function expenseState(
  tx: Transaction,
  accounts: ReadonlyMap<string, Account>,
): ExpenseState {
  const spent = tx.postings.reduce((sum, p) => {
    const account = accounts.get(p.account_id);
    return account?.class === "expense" && p.amount.amount > 0
      ? sum + p.amount.amount
      : sum;
  }, 0);
  const repaid = (tx.referenced_by ?? []).reduce(
    (sum, ref) =>
      ref.type === "reimbursement_of" ? sum + (ref.amount?.amount ?? 0) : sum,
    0,
  );
  return {
    expense: spent > 0 && tx.voided_at === undefined,
    remaining: Math.max(0, spent - repaid),
  };
}
