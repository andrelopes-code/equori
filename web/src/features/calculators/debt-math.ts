import { roundHalfEven } from "@/features/calculators/round";

// A debt in minor units with its monthly rate as a fraction.
export interface Debt {
  name: string;
  balance: number;
  rate: number;
  minimum: number;
}

export type PayoffOrder = "avalanche" | "snowball";

export interface PayoffPlan {
  months: number;
  interest: number;
  closed: { name: string; month: number }[];
}

const maxMonths = 1200;

// The sequence that receives the budget left after the minimums (study §3.3): the avalanche
// pays the highest rate first, ties by the smaller balance; the snowball the smaller balance
// first, ties by the higher rate.
function sequence(debts: readonly Debt[], order: PayoffOrder): number[] {
  return debts
    .map((_, i) => i)
    .sort((a, b) => {
      const x = debts[a];
      const y = debts[b];
      if (x === undefined || y === undefined) return 0;
      return order === "avalanche"
        ? y.rate - x.rate || x.balance - y.balance
        : x.balance - y.balance || y.rate - x.rate;
    });
}

// Design §5, debt-payoff. Each month every open debt accrues its rounded interest, receives its
// minimum capped at its balance, then the rest of the budget goes to the open debts in the
// order's sequence, each capped at its balance.
export function payoffPlan(
  debts: readonly Debt[],
  budget: number,
  order: PayoffOrder,
): PayoffPlan | "below_minimums" | "not_closed" {
  if (budget < debts.reduce((s, d) => s + d.minimum, 0))
    return "below_minimums";
  const balances = debts.map((d) => d.balance);
  const seq = sequence(debts, order);
  const closed: { name: string; month: number }[] = [];
  const done = new Set<number>();
  let interest = 0;
  for (let month = 1; month <= maxMonths; month++) {
    let left = budget;
    const pay = (i: number, amount: number) => {
      const paid = Math.min(amount, balances[i] ?? 0, left);
      balances[i] = (balances[i] ?? 0) - paid;
      left -= paid;
    };
    debts.forEach((d, i) => {
      if ((balances[i] ?? 0) <= 0) return;
      const accrued = roundHalfEven((balances[i] ?? 0) * d.rate);
      balances[i] = (balances[i] ?? 0) + accrued;
      interest += accrued;
    });
    debts.forEach((d, i) => {
      if ((balances[i] ?? 0) > 0) pay(i, d.minimum);
    });
    for (const i of seq) if ((balances[i] ?? 0) > 0) pay(i, left);
    debts.forEach((d, i) => {
      if ((balances[i] ?? 0) !== 0 || done.has(i)) return;
      done.add(i);
      closed.push({ name: d.name, month });
    });
    if (balances.every((b) => b === 0))
      return { months: month, interest, closed };
  }
  return "not_closed";
}
