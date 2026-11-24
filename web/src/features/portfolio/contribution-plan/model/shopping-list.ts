import type { components } from "@/api/schema.gen";
import { effectiveAnswers } from "@/features/portfolio/contribution-plan/model/fact-answers";

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
  // The price of one unit, beside the quantity.
  unit?: Money;
  // The instrument that names a quantity with decimals ("0.00098412 BTC"); a whole quantity is
  // written in units.
  symbol?: string;
  // An account, or a class without instruments: bought by its amount, with no units.
  byValue?: boolean;
  // An instrument member without a unit value: the cost is the planned amount.
  unpriced?: boolean;
  // A class without member targets that holds an instrument: the units wait for a split.
  splitToSee?: boolean;
  // The instrument of a member row: the key of its fund report.
  code?: string;
  // The points of a member of a class with criteria.
  criteria?: { yes: number; count: number };
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
      else entry.byValue = true;
      entries.push(entry);

      return;
    }
    for (const member of cls.members) {
      const cost = member.cost ?? member.amount;
      if (!positive(cost)) continue;
      const entry: ShoppingEntry = { name: memberName(member), cost, group };
      if (member.quantity !== undefined)
        Object.assign(
          entry,
          orderOf(member.quantity, member.unit_value, scaleOf),
        );
      if (member.instrument !== undefined) entry.code = member.instrument;
      const points = pointsOf(member);
      if (cls.questions.length > 0 && points !== undefined)
        entry.criteria = points;
      if (member.instrument === undefined) entry.byValue = true;
      else if (member.unit_value === undefined) entry.unpriced = true;
      entries.push(entry);
    }
  });

  return entries;
}

// The contribution the list spends: the costs plus the leftover, which CN18 makes the amount.
export function contributionOf(
  entries: ShoppingEntry[],
  leftover: Money | undefined,
): Money {
  const costs = entries.reduce((sum, entry) => sum + entry.cost.amount, 0);
  const currency = entries[0]?.cost.currency ?? leftover?.currency ?? "";

  return { amount: costs + (leftover?.amount ?? 0), currency };
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

// The answers "yes" of a member: the ones equori gives, else the investor's (FQ4); undefined with a
// blank one, as the member takes an equal share (CQ3).
function pointsOf(
  member: Plan["classes"][number]["members"][number],
): { yes: number; count: number } | undefined {
  const answers = effectiveAnswers(member.answers ?? [], member.fact_answers);

  if (answers.includes(null)) return undefined;

  return { yes: answers.filter(Boolean).length, count: answers.length };
}

// The units of an order, its unit price, and the instrument when the units carry decimals.
function orderOf(
  quantity: Money,
  unit: Money | undefined,
  scaleOf: (instrument: string) => number,
): Pick<ShoppingEntry, "quantity" | "unit" | "symbol"> {
  const scale = scaleOf(quantity.currency);
  const order: Pick<ShoppingEntry, "quantity" | "unit" | "symbol"> = {
    quantity: decimalOf(quantity.amount, scale),
  };
  if (unit !== undefined) order.unit = unit;
  if (scale > 0) order.symbol = quantity.currency;

  return order;
}

// The integer of an amount at a scale as a decimal string, by position: no division.
function decimalOf(amount: number, scale: number): string {
  if (scale === 0) return String(amount);
  const digits = String(amount).padStart(scale + 1, "0");

  return `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
}
