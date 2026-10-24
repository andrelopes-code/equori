import type { components } from "@/api/schema.gen";

type Account = components["schemas"]["Account"];

// An investment account holds an instrument that is not a currency. The accounts a return can
// start from are the parents of an investment account, then the investment accounts.
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
  return [
    ...accounts.filter((a) => parentIDs.has(a.id)).sort(byLabel),
    ...investment.sort(byLabel),
  ];
}
