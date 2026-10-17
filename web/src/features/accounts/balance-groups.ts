import type { components } from "@/api/schema.gen";

type Account = components["schemas"]["Account"];
type Balance = components["schemas"]["Balance"];
type Money = components["schemas"]["Money"];

export type Group = "available" | "reserves" | "cards" | "loans";

interface BalanceGroup {
  group: Group;
  items: { account: Account; balance: Money }[];
  total: Money;
  excluded: number;
}

const groupOfKind: Record<NonNullable<Account["kind"]>, Group> = {
  checking: "available",
  savings: "available",
  cash: "available",
  wallet: "available",
  benefit: "available",
  reserve: "reserves",
  brokerage: "reserves",
  receivable: "reserves",
  credit_card: "cards",
  loan: "loans",
  payable: "loans",
};

const order: Group[] = ["available", "reserves", "cards", "loans"];

export function groupBalances(
  accounts: Account[],
  balances: Balance[],
  base: string,
): BalanceGroup[] {
  const balanceOf = new Map(balances.map((b) => [b.account_id, b.balance]));
  const byGroup = new Map<Group, BalanceGroup>();
  for (const account of accounts) {
    if (account.kind === undefined) continue;
    const balance = balanceOf.get(account.id) ?? {
      amount: 0,
      currency: account.currency,
    };
    if (account.closed_on !== undefined && balance.amount === 0) continue;
    const group = groupOfKind[account.kind];
    let entry = byGroup.get(group);
    if (entry === undefined) {
      entry = {
        group,
        items: [],
        total: { amount: 0, currency: base },
        excluded: 0,
      };
      byGroup.set(group, entry);
    }
    entry.items.push({ account, balance });
    if (balance.currency === base) {
      entry.total.amount += balance.amount;
    } else {
      entry.excluded += 1;
    }
  }
  return order.flatMap((group) => byGroup.get(group) ?? []);
}
