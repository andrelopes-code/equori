import type { components } from "@/api/schema.gen";

type Plan = components["schemas"]["ContributionPlan"];
type Money = components["schemas"]["Money"];
interface MemberRef {
  account_id?: string;
  instrument?: string;
}

export interface ShoppingEntry {
  name: string;
  amount: Money;
  quantity?: number;
}

// The purchases of a split: each member with an amount, or a class without member targets.
export function shoppingList(
  view: Plan,
  memberName: (ref: MemberRef) => string,
): ShoppingEntry[] {
  const entries: ShoppingEntry[] = [];
  for (const cls of view.classes) {
    const split = cls.members.some((m) => m.target_bp !== undefined);
    if (!split) {
      if (positive(cls.amount))
        entries.push({ name: cls.name, amount: cls.amount });
      continue;
    }
    for (const member of cls.members) {
      if (!positive(member.amount)) continue;
      const entry: ShoppingEntry = {
        name: memberName(member),
        amount: member.amount,
      };
      const quantity = quantityOf(member.amount, member.unit_value);
      if (quantity !== undefined) entry.quantity = quantity;
      entries.push(entry);
    }
  }

  return entries.sort(
    (a, b) => b.amount.amount - a.amount.amount || a.name.localeCompare(b.name),
  );
}

function positive(money: Money | undefined): money is Money {
  return money !== undefined && money.amount > 0;
}

function quantityOf(
  amount: Money,
  unit: Money | undefined,
): number | undefined {
  if (unit === undefined || unit.amount <= 0) return undefined;

  return Number(BigInt(amount.amount) / BigInt(unit.amount));
}
