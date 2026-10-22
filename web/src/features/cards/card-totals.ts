import type { components } from "@/api/schema.gen";

type Account = components["schemas"]["Account"];
type Money = components["schemas"]["Money"];
type Statement = components["schemas"]["StatementSummary"];

const owing = new Set<Statement["status"]>([
  "closed",
  "partially_paid",
  "overdue",
]);

// The statement purchases go on now, and the closed ones not yet paid off, oldest first.
export function currentAndUnpaid(statements: readonly Statement[]): {
  current: Statement | undefined;
  unpaid: Statement[];
} {
  return {
    current: statements.find((s) => s.status === "open"),
    unpaid: statements
      .filter((s) => owing.has(s.status) && s.unpaid.amount > 0)
      .sort((a, b) => a.due_date.localeCompare(b.due_date)),
  };
}

export interface CardTotals {
  open: Money;
  due: Money;
  nearestDue: string | undefined;
  available: Money;
  limit: Money;
}

// The figures of the cards destination, in the base currency: a card in another currency is
// left out of the sums.
export function cardTotals(
  cards: readonly {
    account: Account;
    current: Statement | undefined;
    unpaid: Statement[];
  }[],
  base: string,
): CardTotals {
  const sum = (values: (Money | undefined)[]) =>
    values.reduce(
      (total, m) => total + (m?.currency === base ? m.amount : 0),
      0,
    );
  const unpaid = cards.flatMap((c) => c.unpaid);
  const nearestDue = unpaid.map((s) => s.due_date).sort()[0];
  return {
    open: {
      amount: sum(cards.map((c) => c.current?.amount_due)),
      currency: base,
    },
    due: { amount: sum(unpaid.map((s) => s.unpaid)), currency: base },
    nearestDue,
    available: {
      amount: sum(cards.map((c) => c.account.card?.available_limit)),
      currency: base,
    },
    limit: {
      amount: sum(cards.map((c) => c.account.card?.credit_limit)),
      currency: base,
    },
  };
}
