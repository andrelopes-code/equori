import type { components } from "@/api/schema.gen";
import { returnAccounts } from "@/features/portfolio/return-accounts";

type Account = components["schemas"]["Account"];

// The accounts whose return the balance sheet compares with an index: the accounts a return can
// measure (A208 R7) whose parent is not one, so a brokerage carries the line and its positions
// do not.
export function measuredTops(
  accounts: readonly Account[],
  currencyCodes: ReadonlySet<string>,
): Set<string> {
  const measured = new Set(
    returnAccounts(accounts, currencyCodes, (a) => a.id, "en").map((a) => a.id),
  );

  return new Set(
    [...measured].filter((id) => {
      const parent = accounts.find((a) => a.id === id)?.parent_id;
      return parent === undefined || !measured.has(parent);
    }),
  );
}
