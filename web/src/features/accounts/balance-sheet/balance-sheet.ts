import type { components } from "@/api/schema.gen";
import type { BalanceGroup } from "@/features/accounts/balance-sheet/balance-groups";

type Account = components["schemas"]["Account"];
type Money = components["schemas"]["Money"];
type Item = BalanceGroup["items"][number];

export interface SheetRow {
  account: Account;
  balance: Money;
  // The account and every account under it in the group, in its own currency; a parent's
  // balance holds only its own postings (B2), so its row adds the subtree up.
  subtree: Money;
  depth: number;
  hasChildren: boolean;
  // The parent that stands in the same group.
  parentId?: string;
  // The children of the account that stand in the same group.
  childCount: number;
  // A child in another currency than the base currency: a quantity, not money (AL9).
  position: boolean;
}

export interface Sides {
  assets: number;
  liabilities: number;
  net: number;
}

export type Order = "balance" | "name" | "attention";

export interface SheetRowOptions {
  order?: Order;
  // With the base currency, a child in another currency is a position.
  base?: string;
  // The accounts with an open reconciliation difference.
  differing?: ReadonlySet<string>;
  // Every item is a root: no hierarchy.
  flat?: boolean;
}

interface Node {
  item: Item;
  kids: Node[];
  subtree: number;
  differs: boolean;
  position: boolean;
}

const assetGroups = new Set(["available", "reserves"]);

export function isAssetGroup(group: string): boolean {
  return assetGroups.has(group);
}
const noAccounts: ReadonlySet<string> = new Set();

// Liabilities are kept as the positive amount owed; their balances are negative in the ledger.
export function sides(groups: readonly BalanceGroup[]): Sides {
  let assets = 0;
  let liabilities = 0;
  for (const group of groups) {
    if (isAssetGroup(group.group)) assets += group.total.amount;
    else liabilities -= group.total.amount;
  }
  return { assets, liabilities, net: assets - liabilities };
}

// The group's accounts depth first, children after their parent, siblings in the order of the
// option. A child whose parent stands in another group starts a tree of its own. Positions
// come last under their parent, by name (AL5).
export function sheetRows(
  group: Pick<BalanceGroup, "items">,
  locale: string,
  options: SheetRowOptions = {},
): SheetRow[] {
  const {
    order = "name",
    base,
    differing = noAccounts,
    flat = false,
  } = options;
  const collator = new Intl.Collator(locale, { sensitivity: "base" });
  const nodes = new Map<string, Node>(
    group.items.map((item) => [
      item.account.id,
      {
        item,
        kids: [],
        subtree: item.balance.amount,
        differs: differing.has(item.account.id),
        position: false,
      },
    ]),
  );
  const roots: Node[] = [];
  for (const node of nodes.values()) {
    const parent = flat
      ? undefined
      : nodes.get(node.item.account.parent_id ?? "");
    if (parent === undefined) roots.push(node);
    else parent.kids.push(node);
  }

  const inBase = (node: Node) =>
    base === undefined || node.item.balance.currency === base;
  const byName = (a: Node, b: Node) =>
    collator.compare(a.item.account.name, b.item.account.name);
  const byValue = (a: Node, b: Node) => {
    if (inBase(a) !== inBase(b)) return inBase(a) ? -1 : 1;
    return inBase(a) ? Math.abs(b.subtree) - Math.abs(a.subtree) : 0;
  };
  const rank = (a: Node, b: Node) => {
    if (a.position !== b.position) return a.position ? 1 : -1;
    if (a.position || order === "name") return byName(a, b);
    if (order === "attention" && a.differs !== b.differs)
      return a.differs ? -1 : 1;
    return byValue(a, b) || byName(a, b);
  };

  const settle = (node: Node, depth: number) => {
    node.position =
      base !== undefined && depth > 0 && node.item.balance.currency !== base;
    for (const kid of node.kids) {
      settle(kid, depth + 1);
      if (kid.item.balance.currency === node.item.balance.currency) {
        node.subtree += kid.subtree;
      }
      node.differs ||= kid.differs;
    }
  };
  const rows: SheetRow[] = [];
  const emit = (node: Node, depth: number, parentId: string | undefined) => {
    const { account, balance } = node.item;
    rows.push({
      account,
      balance,
      subtree: { ...balance, amount: node.subtree },
      depth,
      hasChildren: node.kids.length > 0,
      ...(parentId === undefined ? {} : { parentId }),
      childCount: node.kids.length,
      position: node.position,
    });
    for (const kid of [...node.kids].sort(rank))
      emit(kid, depth + 1, account.id);
  };
  for (const root of roots) settle(root, 0);
  for (const root of [...roots].sort(rank)) emit(root, 0, undefined);
  return rows;
}
