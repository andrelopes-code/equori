import type { components } from "@/api/schema.gen";
import type { Goal } from "@/features/goals/goal-line";

type Account = components["schemas"]["Account"];
type Schedule = components["schemas"]["Schedule"];
type Recurrence = components["schemas"]["Recurrence"];

// Months of a year and days of a year, to turn a rule into an amount per month.
const weeksPerMonth = 52 / 12;
const daysPerMonth = 365 / 12;

// What one occurrence of the rule is worth per month, rounded to a minor unit.
export function monthlyEquivalent(
  amount: number,
  recurrence: Pick<Recurrence, "frequency" | "interval">,
): number {
  const perMonth = {
    monthly: 1,
    yearly: 1 / 12,
    weekly: weeksPerMonth,
    daily: daysPerMonth,
  }[recurrence.frequency];
  return Math.round((amount * perMonth) / recurrence.interval);
}

// The goal's accounts and every account below them: a goal over a brokerage counts its
// cash and each security it holds.
export function goalSubtree(
  accountIDs: readonly string[],
  accounts: readonly Account[],
): Set<string> {
  const subtree = new Set(accountIDs);
  let grew = true;
  while (grew) {
    grew = false;
    for (const a of accounts) {
      if (
        a.parent_id !== undefined &&
        subtree.has(a.parent_id) &&
        !subtree.has(a.id)
      ) {
        subtree.add(a.id);
        grew = true;
      }
    }
  }
  return subtree;
}

// The terms in force on a date: the latest version that began on or before it, else the first.
function termsOn(schedule: Schedule, today: string) {
  const sorted = [...schedule.terms].sort((a, b) =>
    a.effective_from.localeCompare(b.effective_from),
  );
  return sorted.filter((t) => t.effective_from <= today).pop() ?? sorted[0];
}

// The monthly aporte already scheduled: savings and transfers that move money from outside the
// goal into it, in the goal's currency, active and not paused today.
export function scheduledContribution(
  goal: Pick<Goal, "account_ids" | "target">,
  schedules: readonly Schedule[],
  accounts: readonly Account[],
  today: string,
): number {
  const subtree = goalSubtree(goal.account_ids, accounts);
  let total = 0;
  for (const s of schedules) {
    if (s.kind !== "savings" && s.kind !== "transfer") continue;
    if (!subtree.has(s.counterpart_id) || subtree.has(s.account_id)) continue;
    if (s.ends_on !== undefined && s.ends_on <= today) continue;
    if (s.pauses.some((p) => p.from <= today && today <= p.to)) continue;
    const terms = termsOn(s, today);
    if (terms === undefined) continue;
    if (terms.amount.currency !== goal.target.currency) continue;
    total += monthlyEquivalent(terms.amount.amount, terms.recurrence);
  }
  return total;
}

const investingKinds = new Set(["brokerage", "savings", "reserve"]);

// A goal that holds a brokerage, a savings account or any account that yields can earn a return.
export function holdsInvestments(
  accountIDs: readonly string[],
  accounts: readonly Account[],
): boolean {
  const subtree = goalSubtree(accountIDs, accounts);
  return accounts.some(
    (a) =>
      subtree.has(a.id) &&
      ((a.kind !== undefined && investingKinds.has(a.kind)) ||
        a.yield_mode !== "none"),
  );
}
