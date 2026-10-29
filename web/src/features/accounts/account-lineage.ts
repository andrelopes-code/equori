import type { components } from "@/api/schema.gen";

type Account = components["schemas"]["Account"];

// The parents of an account up to its root, and every account below it, breadth first.
export function lineage(account: Account, accounts: Account[]) {
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const ancestors: Account[] = [];
  for (let p = account.parent_id; p !== undefined; p = byId.get(p)?.parent_id) {
    const parent = byId.get(p);
    if (parent === undefined) break;
    ancestors.push(parent);
  }
  const descendants: Account[] = [];
  const queue = [account.id];
  for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
    for (const child of accounts.filter((a) => a.parent_id === id)) {
      descendants.push(child);
      queue.push(child.id);
    }
  }
  return { ancestors, descendants };
}
