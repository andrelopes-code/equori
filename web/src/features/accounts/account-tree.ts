import type { components } from "@/api/schema.gen";

type Account = components["schemas"]["Account"];
type AccountClass = Account["class"];

export interface TreeNode {
  account: Account;
  children: TreeNode[];
}

const classOrder: AccountClass[] = [
  "asset",
  "liability",
  "equity",
  "income",
  "expense",
];

function byName(a: TreeNode, b: TreeNode): number {
  return a.account.name.localeCompare(b.account.name);
}

export function buildAccountTree(
  accounts: Account[],
): { class: AccountClass; roots: TreeNode[] }[] {
  const nodes = new Map<string, TreeNode>(
    accounts.map((account) => [account.id, { account, children: [] }]),
  );
  const rootsByClass = new Map<AccountClass, TreeNode[]>();
  for (const node of nodes.values()) {
    const parent =
      node.account.parent_id === undefined
        ? undefined
        : nodes.get(node.account.parent_id);
    if (parent !== undefined) {
      parent.children.push(node);
      continue;
    }
    const roots = rootsByClass.get(node.account.class) ?? [];
    roots.push(node);
    rootsByClass.set(node.account.class, roots);
  }
  for (const node of nodes.values()) node.children.sort(byName);
  return classOrder.flatMap((accountClass) => {
    const roots = rootsByClass.get(accountClass);
    return roots === undefined
      ? []
      : [{ class: accountClass, roots: roots.sort(byName) }];
  });
}
