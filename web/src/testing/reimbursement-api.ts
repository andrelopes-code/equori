import { fakeApi, json } from "@/testing/fake-api";
import type { FakeFetch } from "@/testing/fake-api";
import {
  accounts,
  checkingID,
  foodID,
  sharedRoutes,
  transactionFixture,
  txID,
} from "@/testing/transaction-api";

export const expenseID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const otherExpenseID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
export const incomeID = "99999999-9999-4999-8999-999999999999";

const money = (amount: number) => ({ amount, currency: "BRL" });
const posting = (id: string, account: string, amount: number) => ({
  id,
  account_id: account,
  amount: money(amount),
  weight: money(amount),
  status: "cleared",
});

// An incoming 15.00 waiting for its category.
export function inflowFixture(
  overrides: Record<string, unknown> = {},
  amount = 1500,
): Record<string, unknown> {
  return transactionFixture({
    description: "Transferência Recebida",
    payee_id: undefined,
    tags: [],
    version: 1,
    postings: [
      posting("p1", checkingID, amount),
      posting("p2", incomeID, -amount),
    ],
    ...overrides,
  });
}

export function expenseFixture(
  id: string,
  description: string,
  date: string,
  amount: number,
): Record<string, unknown> {
  return transactionFixture({
    id,
    date,
    description,
    payee_id: undefined,
    tags: [],
    postings: [
      posting("q1", checkingID, -amount),
      posting("q2", foodID, amount),
    ],
  });
}

export const expense = expenseFixture(
  expenseID,
  "Pix enviado EVERTON",
  "2026-10-17",
  1500,
);
export const thirdExpenseID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
export const otherExpense = expenseFixture(
  otherExpenseID,
  "Mercado Pago bakery",
  "2026-10-12",
  4000,
);

export interface Sent {
  path: string;
  body: unknown;
}

export function candidate(
  tx: Record<string, unknown>,
  remaining: number,
  allocated = 0,
) {
  return {
    transaction: tx,
    remaining: money(remaining),
    allocated: money(allocated),
  };
}

export function reimbursementApi(options: {
  transaction?: Record<string, unknown>;
  candidates?: ReturnType<typeof candidate>[];
  suggestion?: string[];
  sent?: Sent[];
  reimburse?: (req: Request) => Response | Promise<Response>;
}): FakeFetch {
  const transaction = options.transaction ?? inflowFixture();
  const sent = options.sent ?? [];
  return fakeApi({
    ...sharedRoutes,
    "GET /api/v1/accounts": () =>
      json(200, {
        items: [
          ...accounts,
          {
            id: incomeID,
            name: "Uncategorized income",
            class: "income",
            system_role: "uncategorized_income",
            currency: "BRL",
          },
        ],
      }),
    "GET /api/v1/transactions": () => json(200, { items: [transaction] }),
    [`GET /api/v1/transactions/${txID}`]: () => json(200, transaction),
    [`GET /api/v1/transactions/${txID}/versions`]: () =>
      json(200, { items: [] }),
    [`GET /api/v1/transactions/${txID}/categorization`]: () =>
      json(404, {
        type: "about:blank",
        title: "Not Found",
        status: 404,
        code: "not_found",
      }),
    [`GET /api/v1/transactions/${txID}/attachments`]: () =>
      json(200, { items: [] }),
    [`GET /api/v1/transactions/${txID}/reimbursement-candidates`]: () =>
      json(200, {
        items: options.candidates ?? [],
        ...(options.suggestion === undefined
          ? {}
          : { suggestion: options.suggestion }),
      }),
    [`POST /api/v1/transactions/${txID}/reimbursement`]:
      options.reimburse ??
      (async (req) => {
        sent.push({ path: "reimbursement", body: await req.json() });
        return json(200, { ...transaction, version: 2 });
      }),
  });
}

export const sourceID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

export function source(tx: Record<string, unknown>, free: number) {
  return { transaction: tx, free: money(free) };
}

// The detail page of an expense (expenseID) and what can repay it.
export function repaymentApi(options: {
  expense?: Record<string, unknown>;
  sources?: ReturnType<typeof source>[];
  sent?: Sent[];
  reimburse?: (req: Request) => Response | Promise<Response>;
}): FakeFetch {
  const expenseTx = options.expense ?? expense;
  const sent = options.sent ?? [];
  const sourceRoutes = Object.fromEntries(
    (options.sources ?? []).map((item) => [
      `POST /api/v1/transactions/${(item.transaction as { id: string }).id}/reimbursement`,
      options.reimburse ??
        (async (req: Request) => {
          sent.push({
            path: (item.transaction as { id: string }).id,
            body: await req.json(),
          });
          return json(200, item.transaction);
        }),
    ]),
  );
  return fakeApi({
    ...sharedRoutes,
    "GET /api/v1/accounts": () =>
      json(200, {
        items: [
          ...accounts,
          {
            id: incomeID,
            name: "Uncategorized income",
            class: "income",
            system_role: "uncategorized_income",
            currency: "BRL",
          },
        ],
      }),
    "GET /api/v1/transactions": () => json(200, { items: [expenseTx] }),
    [`GET /api/v1/transactions/${expenseID}`]: () => json(200, expenseTx),
    [`GET /api/v1/transactions/${expenseID}/versions`]: () =>
      json(200, { items: [] }),
    [`GET /api/v1/transactions/${expenseID}/categorization`]: () =>
      json(404, {
        type: "about:blank",
        title: "Not Found",
        status: 404,
        code: "not_found",
      }),
    [`GET /api/v1/transactions/${expenseID}/attachments`]: () =>
      json(200, { items: [] }),
    [`GET /api/v1/transactions/${expenseID}/reimbursement-sources`]: () =>
      json(200, { items: options.sources ?? [] }),
    ...sourceRoutes,
  });
}
