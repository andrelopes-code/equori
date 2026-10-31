import type { components } from "@/api/schema.gen";
import {
  currentTerms,
  subscriptionCost,
} from "@/features/planning/schedule-words";

type Schedule = components["schemas"]["Schedule"];

export interface RecurringShare {
  currency: string;
  basisPoints: number;
}

// Yearly bills and subscriptions over yearly income, per currency with income. An ended
// schedule is left out. shortcut: pauses and a recurrence `count` are not applied, upgrade
// when a paused or counted schedule must change the figure.
export function recurringShares(
  schedules: readonly Schedule[],
  today: string,
): RecurringShare[] {
  const income = new Map<string, number>();
  const expense = new Map<string, number>();

  for (const s of schedules) {
    if (s.ends_on !== undefined && s.ends_on < today) continue;

    const terms = currentTerms(s.terms, today);
    if (terms === undefined) continue;

    const totals = s.kind === "income" ? income : expense;
    if (s.kind !== "income" && s.kind !== "bill" && s.kind !== "subscription")
      continue;

    const { currency } = terms.amount;
    const yearly = subscriptionCost(
      terms.recurrence,
      terms.amount.amount,
    ).yearly;
    totals.set(currency, (totals.get(currency) ?? 0) + yearly);
  }

  return [...income]
    .filter(([, total]) => total > 0)
    .map(([currency, total]) => ({
      currency,
      basisPoints: Math.round(((expense.get(currency) ?? 0) * 10000) / total),
    }));
}
