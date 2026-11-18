import type { components } from "@/api/schema.gen";

type Account = components["schemas"]["Account"];
type Goal = components["schemas"]["Goal"];

interface MemberRef {
  account_id?: string;
  instrument?: string;
}

// The accounts a goal holds: the whole ones with every account below them, and the ones it
// holds by allocated amounts.
function goalAccounts(goal: Goal, accounts: readonly Account[]): Set<string> {
  const held = new Set(goal.account_ids);
  let grew = true;
  while (grew) {
    grew = false;
    for (const a of accounts) {
      if (
        a.parent_id !== undefined &&
        held.has(a.parent_id) &&
        !held.has(a.id)
      ) {
        held.add(a.id);
        grew = true;
      }
    }
  }
  for (const a of goal.allocated_accounts) held.add(a.account_id);

  return held;
}

// The goal that holds a member of the contribution plan (CN20): the member's account, or, for a
// member named by its instrument, one of the accounts that hold that instrument. Undefined when
// no goal does; the first goal when several do.
export function reservedFor(
  member: MemberRef,
  goals: readonly Goal[],
  accounts: readonly Account[],
): string | undefined {
  const own =
    member.account_id !== undefined
      ? [member.account_id]
      : accounts
          .filter((a) => a.currency === member.instrument)
          .map((a) => a.id);

  return goals.find((g) => {
    const held = goalAccounts(g, accounts);
    return own.some((id) => held.has(id));
  })?.name;
}
