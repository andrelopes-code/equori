import type { components } from "@/api/schema.gen";
import type { BalanceGroup } from "@/features/accounts/balance-groups";

type Account = components["schemas"]["Account"];
type Money = components["schemas"]["Money"];

export interface SheetRow {
  account: Account;
  balance: Money;
  // The account and every account under it in the group, in its own currency; a parent's
  // balance holds only its own postings (B2), so its row adds the subtree up.
  subtree: Money;
  depth: number;
  hasChildren: boolean;
}

export interface Sides {
  assets: number;
  liabilities: number;
  net: number;
}

const assetGroups = new Set(["available", "reserves"]);

// Liabilities are kept as the positive amount owed; their balances are negative in the ledger.
export function sides(groups: readonly BalanceGroup[]): Sides {
  let assets = 0;
  let liabilities = 0;
  for (const group of groups) {
    if (assetGroups.has(group.group)) assets += group.total.amount;
    else liabilities -= group.total.amount;
  }
  return { assets, liabilities, net: assets - liabilities };
}

// The group's accounts depth first, children after their parent and siblings by name. A child
// whose parent stands in another group starts a tree of its own.
export function sheetRows(group: BalanceGroup, locale: string): SheetRow[] {
  const collator = new Intl.Collator(locale, { sensitivity: "base" });
  const inGroup = new Map(group.items.map((item) => [item.account.id, item]));
  const children = new Map<string, typeof group.items>();
  const roots: typeof group.items = [];
  for (const item of group.items) {
    const parent = item.account.parent_id;
    if (parent !== undefined && inGroup.has(parent)) {
      children.set(parent, [...(children.get(parent) ?? []), item]);
    } else {
      roots.push(item);
    }
  }
  const byName = (a: (typeof roots)[number], b: (typeof roots)[number]) =>
    collator.compare(a.account.name, b.account.name);
  const rows: SheetRow[] = [];
  const visit = (item: (typeof roots)[number], depth: number): number => {
    const index = rows.length;
    const kids = [...(children.get(item.account.id) ?? [])].sort(byName);
    rows.push({
      account: item.account,
      balance: item.balance,
      subtree: item.balance,
      depth,
      hasChildren: kids.length > 0,
    });
    let total = item.balance.amount;
    for (const kid of kids) {
      const sub = visit(kid, depth + 1);
      if (kid.balance.currency === item.balance.currency) total += sub;
    }
    const row = rows[index];
    if (row !== undefined) row.subtree = { ...item.balance, amount: total };
    return total;
  };
  for (const root of [...roots].sort(byName)) visit(root, 0);
  return rows;
}
