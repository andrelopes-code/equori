import type { components } from "@/api/schema.gen";

type Account = components["schemas"]["Account"];

// An investment account holds an instrument that is not a currency. The accounts a return can
// start from are the parents of an investment account, the investment accounts, then the savings
// and reserve accounts (amendment A208 R7).
export function returnAccounts(
  accounts: readonly Account[],
  currencyCodes: ReadonlySet<string>,
  labelOf: (account: Account) => string,
  tag: string,
): Account[] {
  const investment = accounts.filter(
    (a) => a.class === "asset" && !currencyCodes.has(a.currency),
  );
  const parentIDs = new Set(investment.map((a) => a.parent_id));
  const byLabel = (a: Account, b: Account) =>
    labelOf(a).localeCompare(labelOf(b), tag);
  const parents = accounts.filter((a) => parentIDs.has(a.id));
  const savings = accounts.filter(
    (a) =>
      a.class === "asset" &&
      (a.kind === "savings" || a.kind === "reserve") &&
      !parentIDs.has(a.id) &&
      currencyCodes.has(a.currency),
  );

  return [
    ...parents.sort(byLabel),
    ...investment.sort(byLabel),
    ...savings.sort(byLabel),
  ];
}
