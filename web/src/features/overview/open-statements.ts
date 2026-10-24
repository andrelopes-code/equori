import type { components } from "@/api/schema.gen";

type Account = components["schemas"]["Account"];
type Statement = components["schemas"]["StatementSummary"];
type Money = components["schemas"]["Money"];

export interface OwedStatement {
  account: Account;
  statement: Statement;
  amount: Money;
  // The statement purchases still go on: its amount is what is billed so far.
  open: boolean;
}

// An open statement owes its amount due; a closed one owes what is still unpaid.
export function owedStatements(
  cards: readonly {
    account: Account;
    current: Statement | undefined;
    unpaid: readonly Statement[];
  }[],
): OwedStatement[] {
  return cards
    .flatMap(({ account, current, unpaid }) => [
      ...unpaid.map((statement) => ({
        account,
        statement,
        amount: statement.unpaid,
        open: false,
      })),
      ...(current === undefined || current.amount_due.amount <= 0
        ? []
        : [
            {
              account,
              statement: current,
              amount: current.amount_due,
              open: true,
            },
          ]),
    ])
    .sort((a, b) => a.statement.due_date.localeCompare(b.statement.due_date));
}
