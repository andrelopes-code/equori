import type { components } from "@/api/schema.gen";
import { shapeOf } from "@/features/accounts";

type Account = components["schemas"]["Account"];

export type AccountGroup = "accounts" | "cards" | "reserves";

// The order never changes with the entry: a reader finds an account where it was last time.
export const groupOrder: readonly AccountGroup[] = [
  "accounts",
  "cards",
  "reserves",
];

const groupOfShape = {
  square: "accounts",
  card: "cards",
  circle: "reserves",
} as const;

export function groupOf(account: Account): AccountGroup {
  return groupOfShape[shapeOf(account.kind)];
}

// The balance accounts an entry can move money through: open ones, plus the one already chosen
// when it has closed since. A parent account takes no posting, its sub-accounts do.
export function pickable(
  accounts: readonly Account[],
  value: string | null,
  exclude: string | null,
): Account[] {
  const parents = new Set(accounts.map((a) => a.parent_id));
  return accounts.filter(
    (a) =>
      (a.class === "asset" || a.class === "liability") &&
      !parents.has(a.id) &&
      a.system_role === undefined &&
      (a.closed_on === undefined || a.id === value) &&
      a.id !== exclude,
  );
}

export function groupAccounts(
  accounts: readonly Account[],
  collator: Intl.Collator,
): { group: AccountGroup; accounts: Account[] }[] {
  return groupOrder
    .map((group) => ({
      group,
      accounts: accounts
        .filter((a) => groupOf(a) === group)
        .sort((a, b) => collator.compare(a.name, b.name)),
    }))
    .filter((g) => g.accounts.length > 0);
}
