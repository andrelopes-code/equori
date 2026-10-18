import type { components } from "@/api/schema.gen";
import { json } from "@/testing/fake-api";
import { checkingID, savingsID, sharedRoutes } from "@/testing/transaction-api";

export { checkingID, savingsID };

export type Statement = components["schemas"]["StatementSummary"];

export const cardID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const money = (amount: number) => ({ amount, currency: "BRL" });

export const cardAccount = {
  id: cardID,
  name: "Nubank card",
  class: "liability",
  kind: "credit_card",
  currency: "BRL",
  opened_on: "2026-01-01",
  yield_mode: "none",
  card: { credit_limit: money(500000), available_limit: money(400000) },
};

export const accounts = [
  cardAccount,
  {
    id: checkingID,
    name: "Nubank checking",
    class: "asset",
    kind: "checking",
    currency: "BRL",
    opened_on: "2026-01-01",
    yield_mode: "none",
  },
  {
    id: savingsID,
    name: "Reserva",
    class: "asset",
    kind: "savings",
    currency: "BRL",
    opened_on: "2026-01-01",
    yield_mode: "none",
  },
];

export function statementID(reference: string): string {
  return `statement-${reference}`;
}

export function statement(
  reference: string,
  over: Partial<Statement> = {},
): Statement {
  return {
    id: statementID(reference),
    account_id: cardID,
    reference,
    closing_date: `${reference}-03`,
    due_date: `${reference}-10`,
    opening: money(0),
    charges: money(50000),
    credits: money(0),
    amount_due: money(50000),
    payments: money(0),
    unpaid: money(50000),
    status: "open",
    reconciled: false,
    ...over,
  };
}

export const billingRule = {
  effective_from: "2026-01",
  closing_day: 3,
  due_day: 10,
  closing_day_assignment: "next",
  due_date_adjustment: "following",
  calendar: "br_banking",
};

type Route = (req: Request) => Response | Promise<Response>;

const base = `GET /api/v1/accounts/${cardID}`;

export function cardRoutes(
  over: Record<string, Route> = {},
): Record<string, Route> {
  return {
    ...sharedRoutes,
    "GET /api/v1/accounts": () => json(200, { items: accounts }),
    [base]: () => json(200, cardAccount),
    [`${base}/balance`]: () =>
      json(200, {
        account_id: cardID,
        date: "2026-10-17",
        basis: "booked",
        balance: money(-100000),
      }),
    [`${base}/statements`]: () =>
      json(200, {
        items: [
          statement("2026-10", { status: "paid", unpaid: money(0) }),
          statement("2026-11"),
          statement("2026-12"),
        ],
      }),
    [`${base}/billing-cycle-rules`]: () => json(200, { items: [billingRule] }),
    [`${base}/credit-limits`]: () =>
      json(200, {
        items: [{ effective_from: "2026-01-01", amount: money(500000) }],
      }),
    [`${base}/cards`]: () =>
      json(200, {
        items: [
          {
            id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            holder: "Ana",
            last_four: "1234",
            virtual: false,
            active: true,
          },
        ],
      }),
    ...over,
  };
}
