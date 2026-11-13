import type { Kind } from "@/features/accounts/model/account-kinds";

const perRow = 3;

const steps: Record<string, number> = {
  ArrowRight: 1,
  ArrowLeft: -1,
  ArrowDown: perRow,
  ArrowUp: -perRow,
};

// KC1: the assets, then the liabilities. `kinds` lists savings and reserve before cash, so the
// order is written out.
export const kindOrder: readonly Kind[] = [
  "checking",
  "cash",
  "wallet",
  "benefit",
  "savings",
  "reserve",
  "brokerage",
  "receivable",
  "credit_card",
  "loan",
  "payable",
];

// KC4: the kind a key moves the choice to, stopping at the ends; null when the key is not handled.
export function nextKind(current: Kind | null, key: string): Kind | null {
  const step = steps[key];

  if (step === undefined) return null;

  const from = current === null ? -1 : kindOrder.indexOf(current);
  const to = Math.min(Math.max(from + step, 0), kindOrder.length - 1);

  return kindOrder[to] ?? null;
}
