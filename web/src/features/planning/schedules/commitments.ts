import type { components } from "@/api/schema.gen";
import {
  currentTerms,
  hasEnded,
  subscriptionCost,
} from "@/features/planning/model/schedule-words";
import { recurringShares } from "@/features/planning/recurring-share/recurring-share";

type Money = components["schemas"]["Money"];
type Schedule = components["schemas"]["Schedule"];

export interface Commitments {
  currency: string;
  // Monthly amounts in the currency, minor units.
  income: number;
  bills: number;
  subscriptions: number;
  savings: number;
  // Income minus bills, subscriptions and savings; negative when they exceed it.
  free: number;
  // Yearly bills and subscriptions over yearly income (recurringShares); undefined without income.
  shareBp: number | undefined;
  counts: { income: number; billsAndSubscriptions: number; savings: number };
  // The monthly cost of each other currency: never added, named on screen (spec B1).
  leftOut: Money[];
}

// What the schedules in force today commit each month, in one currency (spec B1). A transfer
// moves money between the owner's accounts and commits nothing.
export function commitments(
  schedules: readonly Schedule[],
  today: string,
  currency: string,
): Commitments {
  const sums = { income: 0, bill: 0, subscription: 0, savings: 0 };
  const counts = { income: 0, billsAndSubscriptions: 0, savings: 0 };
  const other = new Map<string, number>();

  for (const s of schedules) {
    if (hasEnded(s.ends_on, today) || s.kind === "transfer") continue;

    const terms = currentTerms(s.terms, today);
    if (terms === undefined) continue;

    const monthly = subscriptionCost(
      terms.recurrence,
      terms.amount.amount,
    ).monthly;
    if (terms.amount.currency !== currency) {
      other.set(
        terms.amount.currency,
        (other.get(terms.amount.currency) ?? 0) + monthly,
      );
      continue;
    }

    sums[s.kind] += monthly;
    if (s.kind === "income") counts.income += 1;
    else if (s.kind === "savings") counts.savings += 1;
    else counts.billsAndSubscriptions += 1;
  }

  return {
    currency,
    income: sums.income,
    bills: sums.bill,
    subscriptions: sums.subscription,
    savings: sums.savings,
    free: sums.income - sums.bill - sums.subscription - sums.savings,
    shareBp: recurringShares(schedules, today).find(
      (s) => s.currency === currency,
    )?.basisPoints,
    counts,
    leftOut: [...other]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code, amount]) => ({ amount, currency: code })),
  };
}

export interface CommitmentPart {
  key: "bill" | "subscription" | "savings" | "free";
  amount: number;
  // Share of the fixed income.
  bp: number;
}

// The fixed income split into the kinds that take from it and what is left free (spec B2); no
// free part when the commitments exceed the income, no part without income.
export function commitmentParts(c: Commitments): CommitmentPart[] {
  if (c.income <= 0) return [];

  const parts: { key: CommitmentPart["key"]; amount: number }[] = [
    { key: "bill", amount: c.bills },
    { key: "subscription", amount: c.subscriptions },
    { key: "savings", amount: c.savings },
    { key: "free", amount: c.free },
  ];

  return parts
    .filter((p) => p.amount > 0)
    .map((p) => ({ ...p, bp: Math.round((p.amount * 10000) / c.income) }));
}
