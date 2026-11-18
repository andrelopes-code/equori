import type { components } from "@/api/schema.gen";

type Account = components["schemas"]["Account"];
type Goal = components["schemas"]["Goal"];

// How a goal holds one account (planning coherence A255): whole, or a part of it by amount, with
// the amount to set aside when the goal is saved.
export interface GoalLink {
  id: string;
  part: boolean;
  amount: number;
}

// An account several goals can share by amount: an open asset account without sub-accounts whose
// instrument is a currency.
// shortcut: a currency is read as a three-letter code; the server rejects any other instrument.
export function canShare(account: Account, all: readonly Account[]): boolean {
  return (
    account.class === "asset" &&
    account.closed_on === undefined &&
    /^[A-Z]{3}$/u.test(account.currency) &&
    !all.some((a) => a.parent_id === account.id)
  );
}

export function linksOf(goal: Goal | undefined): GoalLink[] {
  return [
    ...(goal?.account_ids ?? []).map((id) => ({ id, part: false, amount: 0 })),
    ...(goal?.allocated_accounts ?? []).map((a) => ({
      id: a.account_id,
      part: true,
      amount: 0,
    })),
  ];
}

// The links after the chosen accounts changed: a kept account keeps its link, a new one is whole.
export function syncLinks(
  links: readonly GoalLink[],
  ids: readonly string[],
): GoalLink[] {
  return ids.map(
    (id) => links.find((l) => l.id === id) ?? { id, part: false, amount: 0 },
  );
}

export function setLink(
  links: readonly GoalLink[],
  id: string,
  change: Partial<Omit<GoalLink, "id">>,
): GoalLink[] {
  return links.map((l) => (l.id === id ? { ...l, ...change } : l));
}

// The two lists the API takes and the amounts to set aside once the goal is saved.
export function linkBody(links: readonly GoalLink[]) {
  return {
    account_ids: links.filter((l) => !l.part).map((l) => l.id),
    allocated_account_ids: links.filter((l) => l.part).map((l) => l.id),
    allocations: links
      .filter((l) => l.part && l.amount > 0)
      .map((l) => ({ account: l.id, amount: l.amount })),
  };
}

export interface SharedLine {
  account: string;
  goal: string;
}

// The accounts of a goal that another goal holds too, each with the other goal's name.
export function sharedLines(
  goal: Goal,
  goals: readonly Goal[],
  names: ReadonlyMap<string, string>,
): SharedLine[] {
  const held = (g: Goal) => [
    ...g.account_ids,
    ...g.allocated_accounts.map((a) => a.account_id),
  ];
  const own = new Set(held(goal));

  return goals
    .filter((g) => g.id !== goal.id && goal.shared_with.includes(g.id))
    .flatMap((g) =>
      held(g)
        .filter((id) => own.has(id))
        .map((id) => ({ account: names.get(id) ?? "", goal: g.name })),
    );
}

// The saving the schedule form opens with for a goal: into its first whole account, or into its
// first shared account with the goal named, so each occurrence is set aside for it. Undefined
// without an amount or an account.
export function schedulePreset(goal: Goal, amount: number) {
  const whole = goal.account_ids[0];
  const shared = goal.allocated_accounts[0]?.account_id;
  const counterpart = whole ?? shared;
  if (amount <= 0 || counterpart === undefined) return undefined;

  return {
    kind: "savings" as const,
    counterpart,
    amount,
    description: goal.name,
    ...(whole === undefined ? { goal: goal.id } : {}),
  };
}
