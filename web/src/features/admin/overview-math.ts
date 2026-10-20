interface Money {
  amount: number;
  currency: string;
}

export interface BalanceTotal {
  currency: string;
  asset: number;
  liability: number;
  // Asset plus liability: a liability's balance is negative while it is owed.
  net: number;
}

// GET /balances lists each account's own postings, so adding every row counts each posting once.
export function balanceTotals(
  balances: readonly { account_id: string; balance: Money }[],
  classOf: ReadonlyMap<string, string>,
): BalanceTotal[] {
  const totals = new Map<string, BalanceTotal>();
  for (const { account_id, balance } of balances) {
    const kind = classOf.get(account_id);
    if (kind !== "asset" && kind !== "liability") continue;
    const total = totals.get(balance.currency) ?? {
      currency: balance.currency,
      asset: 0,
      liability: 0,
      net: 0,
    };
    total[kind] += balance.amount;
    total.net += balance.amount;
    totals.set(balance.currency, total);
  }
  return [...totals.values()].sort((a, b) =>
    a.currency.localeCompare(b.currency),
  );
}

export interface FlowAccount {
  account_id: string;
  class: string;
  total: Money;
  postings: number;
}

export interface FlowTotal {
  currency: string;
  // Income postings are credits; income is their sum with the sign turned.
  income: number;
  expense: number;
  result: number;
}

interface FlowTransaction {
  voided_at?: string;
  postings: readonly { account_id: string; amount: Money }[];
}

export function monthFlows(
  transactions: readonly FlowTransaction[],
  classOf: ReadonlyMap<string, string>,
): { accounts: FlowAccount[]; totals: FlowTotal[] } {
  const accounts = new Map<string, FlowAccount>();
  const totals = new Map<string, FlowTotal>();
  for (const tx of transactions) {
    if (tx.voided_at !== undefined) continue;
    for (const posting of tx.postings) {
      const kind = classOf.get(posting.account_id);
      if (kind !== "income" && kind !== "expense") continue;
      const { amount, currency } = posting.amount;
      const key = `${posting.account_id}|${currency}`;
      const account = accounts.get(key) ?? {
        account_id: posting.account_id,
        class: kind,
        total: { amount: 0, currency },
        postings: 0,
      };
      account.total.amount += amount;
      account.postings += 1;
      accounts.set(key, account);
      const total = totals.get(currency) ?? {
        currency,
        income: 0,
        expense: 0,
        result: 0,
      };
      if (kind === "income") total.income -= amount;
      else total.expense += amount;
      total.result = total.income - total.expense;
      totals.set(currency, total);
    }
  }
  return {
    accounts: [...accounts.values()].sort(
      (a, b) =>
        a.class.localeCompare(b.class) ||
        Math.abs(b.total.amount) - Math.abs(a.total.amount),
    ),
    totals: [...totals.values()],
  };
}

const statementFigures = [
  "opening",
  "charges",
  "credits",
  "amount_due",
  "payments",
  "unpaid",
] as const;

type StatementFigures = Record<(typeof statementFigures)[number], Money>;

export type StatementMonth = {
  reference: string;
  statements: number;
} & StatementFigures;

// One row per reference month and currency, adding the statements of every card.
export function statementMonths(
  statements: readonly ({ reference: string } & StatementFigures)[],
): StatementMonth[] {
  const months = new Map<string, StatementMonth>();
  for (const statement of statements) {
    const currency = statement.amount_due.currency;
    const key = `${statement.reference}|${currency}`;
    const month =
      months.get(key) ??
      ({
        reference: statement.reference,
        statements: 0,
        ...Object.fromEntries(
          statementFigures.map((figure) => [figure, { amount: 0, currency }]),
        ),
      } as StatementMonth);
    month.statements += 1;
    for (const figure of statementFigures) {
      month[figure] = {
        amount: month[figure].amount + statement[figure].amount,
        currency,
      };
    }
    months.set(key, month);
  }
  return [...months.values()].sort((a, b) =>
    b.reference.localeCompare(a.reference),
  );
}
