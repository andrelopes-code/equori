import type { components } from "@/api/schema.gen";

type Account = components["schemas"]["Account"];

// The accounts that can hold an account of the class, by name. The edited account and the
// accounts inside it are left out: choosing one would make a cycle.
export function parentCandidates(
  accounts: readonly Account[],
  cls: "asset" | "liability",
  editingId?: string,
): Account[] {
  const excluded =
    editingId === undefined
      ? new Set<string>()
      : descendantsOf(editingId, accounts);

  return accounts
    .filter(
      (a) =>
        a.class === cls &&
        a.system_role === undefined &&
        a.closed_on === undefined &&
        !excluded.has(a.id),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

function descendantsOf(id: string, accounts: readonly Account[]): Set<string> {
  const found = new Set<string>([id]);
  for (let grew = true; grew;) {
    grew = false;
    for (const account of accounts) {
      if (
        account.parent_id !== undefined &&
        found.has(account.parent_id) &&
        !found.has(account.id)
      ) {
        found.add(account.id);
        grew = true;
      }
    }
  }

  return found;
}
