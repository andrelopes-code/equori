import type { components } from "@/api/schema.gen";

type Plan = components["schemas"]["ContributionPlan"];
type Money = components["schemas"]["Money"];
interface MemberRef {
  account_id?: string;
  instrument?: string;
}

export interface ShoppingEntry {
  name: string;
  // What the entry costs (CN17): the order of the server, or the planned amount without one.
  cost: Money;
  // The units of the order as a decimal string of the instrument scale, "0.00150000" at scale 8.
  quantity?: string;
  // A class without member targets that holds an instrument: the units wait for a split.
  splitToSee?: boolean;
  // The position of the entry's class in the plan: it picks the class colour.
  group: number;
}

// The purchases of a split, largest cost first.
export function shoppingList(
  view: Plan,
  memberName: (ref: MemberRef) => string,
  scaleOf: (instrument: string) => number = () => 0,
): ShoppingEntry[] {
  return receivingEntries(view, memberName, scaleOf).sort(
    (a, b) => b.cost.amount - a.cost.amount || a.name.localeCompare(b.name),
  );
}

// The entries that receive money, in plan order: each member with a cost, or a class without
// member targets.
export function receivingEntries(
  view: Plan,
  memberName: (ref: MemberRef) => string,
  scaleOf: (instrument: string) => number = () => 0,
): ShoppingEntry[] {
  const entries: ShoppingEntry[] = [];
  view.classes.forEach((cls, group) => {
    const split = cls.members.some((m) => m.target_bp !== undefined);
    if (!split) {
      const cost = cls.cost ?? cls.amount;
      if (!positive(cost)) return;
      const entry: ShoppingEntry = { name: cls.name, cost, group };
      if (unitsWaitForSplit(cls)) entry.splitToSee = true;
      entries.push(entry);

      return;
    }
    for (const member of cls.members) {
      const cost = member.cost ?? member.amount;
      if (!positive(cost)) continue;
      const entry: ShoppingEntry = { name: memberName(member), cost, group };
      if (member.quantity !== undefined)
        entry.quantity = decimalOf(
          member.quantity.amount,
          scaleOf(member.quantity.currency),
        );
      entries.push(entry);
    }
  });

  return entries;
}

export function positive(money: Money | undefined): money is Money {
  return money !== undefined && money.amount > 0;
}

// Whether a class holds instruments but no member targets, so no order has units yet.
export function unitsWaitForSplit(group: Plan["classes"][number]): boolean {
  return (
    group.members.every((m) => m.target_bp === undefined) &&
    group.members.some((m) => m.instrument !== undefined)
  );
}

// What a group receives: the cost of its order, or the sum of the costs of its members when it
// splits its target among them.
export function groupCost(group: Plan["classes"][number]): Money | undefined {
  if (group.cost !== undefined) return group.cost;
  const costs = group.members.map((m) => m.cost);
  if (costs.length === 0 || costs.some((c) => c === undefined))
    return group.amount;
  const currency = costs[0]?.currency ?? "";

  return {
    amount: costs.reduce((sum, c) => sum + (c?.amount ?? 0), 0),
    currency,
  };
}

// The integer of an amount at a scale as a decimal string, by position: no division.
function decimalOf(amount: number, scale: number): string {
  if (scale === 0) return String(amount);
  const digits = String(amount).padStart(scale + 1, "0");

  return `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}
