import type { components } from "@/api/schema.gen";
import { goalSubtree } from "@/features/goals/goal-contribution";

type Account = components["schemas"]["Account"];

// A goal sums the value of each account and of its sub-accounts, so any open asset account
// can hold one, a brokerage with its cash and securities included.
export function goalAccounts(accounts: Account[]): Account[] {
  return accounts.filter(
    (a) =>
      a.class === "asset" &&
      a.closed_on === undefined &&
      a.system_role === undefined,
  );
}

// A goal never holds an account and one of its sub-accounts: the second would count twice.
// The accounts above and below a chosen one leave the choices.
export function withoutNesting(
  offered: Account[],
  all: Account[],
  chosen: readonly string[],
): Account[] {
  const below = new Set<string>();
  const above = new Set<string>();
  for (const id of chosen) {
    for (const d of goalSubtree([id], all)) if (d !== id) below.add(d);
    for (const a of all) {
      if (a.id !== id && goalSubtree([a.id], all).has(id)) above.add(a.id);
    }
  }
  return offered.filter((a) => !below.has(a.id) && !above.has(a.id));
}
