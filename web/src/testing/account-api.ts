import { json } from "@/testing/fake-api";

type Route = (req: Request) => Response | Promise<Response>;

export const checkingID = "a1000000-0000-4000-8000-000000000001";
export const reserveID = "a1000000-0000-4000-8000-000000000002";
export const cardID = "a1000000-0000-4000-8000-000000000003";
export const brokerageID = "a1000000-0000-4000-8000-000000000004";
export const stockID = "a1000000-0000-4000-8000-000000000005";
export const parentID = "a1000000-0000-4000-8000-000000000006";
export const cashID = "a1000000-0000-4000-8000-000000000007";
export const usdID = "a1000000-0000-4000-8000-000000000008";
export const loanID = "a1000000-0000-4000-8000-000000000009";
export const closedID = "a1000000-0000-4000-8000-00000000000a";
export const openingID = "a1000000-0000-4000-8000-00000000000b";
export const foodID = "a1000000-0000-4000-8000-00000000000c";
export const nubankID = "b1000000-0000-4000-8000-000000000001";
export const itauID = "b1000000-0000-4000-8000-000000000002";
export const connectionID = "c1000000-0000-4000-8000-000000000001";
export const externalCheckingID = "c2000000-0000-4000-8000-000000000001";
export const externalReservedID = "c2000000-0000-4000-8000-000000000002";
export const externalCardID = "c2000000-0000-4000-8000-000000000003";

export function money(amount: number, currency = "BRL") {
  return { amount, currency };
}

const base = { currency: "BRL", opened_on: "2026-01-01", yield_mode: "none" };

export const accountFixtures = [
  {
    ...base,
    id: checkingID,
    name: "Nubank",
    class: "asset",
    kind: "checking",
    institution_id: nubankID,
  },
  {
    ...base,
    id: reserveID,
    name: "Reserva de emergência",
    class: "asset",
    kind: "reserve",
    institution_id: nubankID,
    yield_mode: "auto",
  },
  {
    ...base,
    id: cardID,
    name: "Itaú Visa",
    class: "liability",
    kind: "credit_card",
    institution_id: itauID,
    card: { credit_limit: money(800000), available_limit: money(550000) },
  },
  {
    ...base,
    id: brokerageID,
    name: "Corretora",
    class: "asset",
    kind: "brokerage",
  },
  {
    ...base,
    id: stockID,
    name: "PETR4",
    class: "asset",
    kind: "brokerage",
    currency: "PETR4",
    parent_id: brokerageID,
  },
  { ...base, id: parentID, name: "Carteiras", class: "asset", kind: "wallet" },
  {
    ...base,
    id: cashID,
    name: "Dinheiro",
    class: "asset",
    kind: "cash",
    parent_id: parentID,
  },
  {
    ...base,
    id: usdID,
    name: "Wise USD",
    class: "asset",
    kind: "checking",
    currency: "USD",
  },
  {
    ...base,
    id: loanID,
    name: "Financiamento",
    class: "liability",
    kind: "loan",
  },
  {
    ...base,
    id: closedID,
    name: "Conta antiga",
    class: "asset",
    kind: "checking",
    closed_on: "2026-06-30",
  },
  {
    ...base,
    id: openingID,
    name: "Opening balances",
    class: "equity",
    system_role: "opening_balances",
  },
  { ...base, id: foodID, name: "Mercado", class: "expense" },
];

export const institutionFixtures = [
  {
    id: nubankID,
    name: "Nubank",
    code: "260",
    identifier: { scheme: "br_ispb", identifier: "18236120" },
  },
  { id: itauID, name: "Itaú", code: "341" },
];

// Balances on any date: each item is the account's own postings (B2).
export const balanceFixtures: Record<string, number> = {
  [checkingID]: 524055,
  [reserveID]: 1000000,
  [cardID]: -250000,
  [brokerageID]: 0,
  [stockID]: 100,
  [parentID]: 0,
  [cashID]: 15000,
  [usdID]: 30000,
  [loanID]: -1200000,
  [closedID]: 0,
};

export const connectionFixture = {
  id: connectionID,
  integration_id: "c0000000-0000-4000-8000-000000000001",
  external_id: "item-1",
  name: "Nubank",
  state: "ok",
  provider_status: "UPDATED",
  last_item_update_at: "2026-10-17T06:00:00Z",
  next_item_update_at: "2026-10-18T06:00:00Z",
  last_synced_at: "2026-10-17T07:00:00Z",
  created_at: "2026-09-01T12:00:00Z",
  accounts: [
    {
      id: externalCheckingID,
      type: "BANK",
      subtype: "CHECKING_ACCOUNT",
      name: "Conta Corrente",
      number_last4: "1234",
      currency: "BRL",
      state: "mapped",
      account_id: checkingID,
      sync_from: "2026-09-01",
      last_synced_on: "2026-10-17",
    },
    {
      id: externalReservedID,
      type: "BANK",
      subtype: "RESERVED_BALANCE",
      name: "Caixinha Viagem",
      currency: "BRL",
      state: "pending",
    },
    {
      id: externalCardID,
      type: "CREDIT",
      subtype: "CREDIT_CARD",
      name: "Nubank Mastercard",
      number_last4: "9876",
      currency: "BRL",
      state: "pending",
    },
  ],
};

export function balancesAt(req: Request) {
  const query = new URL(req.url).searchParams;
  const date = query.get("date") ?? "2026-10-17";
  const basis = query.get("basis") ?? "booked";
  return json(200, {
    items: accountFixtures
      .filter((a) => a.class === "asset" || a.class === "liability")
      .map((a) => ({
        account_id: a.id,
        date,
        basis,
        balance: money(balanceFixtures[a.id] ?? 0, a.currency),
      })),
  });
}

// Every GET an account screen reads, with fixed answers; a test overrides the routes it asserts on.
export function accountRoutes(
  overrides: Record<string, Route> = {},
): Record<string, Route> {
  return {
    "GET /api/v1/me": () =>
      json(200, {
        id: 1,
        email: "a@b.c",
        role: "admin",
        language: "en",
        region: "BR",
      }),
    "GET /api/v1/settings": () => json(200, { base_currency: "BRL" }),
    "GET /api/v1/instruments": () =>
      json(200, {
        items: [
          { code: "BRL", type: "currency", scale: 2, name: "Real" },
          { code: "USD", type: "currency", scale: 2, name: "Dollar" },
          { code: "PETR4", type: "stock", scale: 0, name: "Petrobras PN" },
        ],
      }),
    "GET /api/v1/accounts": () => json(200, { items: accountFixtures }),
    "GET /api/v1/institutions": () => json(200, { items: institutionFixtures }),
    "GET /api/v1/institution-identifier-schemes": () =>
      json(200, {
        items: [
          { id: "br_ispb", pattern: "^[0-9]{8}$" },
          { id: "bic", pattern: "^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$" },
        ],
      }),
    "GET /api/v1/balances": balancesAt,
    "GET /api/v1/connections": () => json(200, { items: [connectionFixture] }),
    "GET /api/v1/goals": () => json(200, { items: [] }),
    "GET /api/v1/schedules": () => json(200, { items: [] }),
    "GET /api/v1/payees": () => json(200, { items: [] }),
    "GET /api/v1/tags": () => json(200, { items: [] }),
    "GET /api/v1/transactions": () => json(200, { items: [] }),
    "GET /api/v1/import-batches": () => json(200, { items: [] }),
    "GET /api/v1/reports/balances": (req) => {
      const query = new URL(req.url).searchParams;
      const from = query.get("from") ?? "2026-10-01";
      return json(200, {
        items: [
          { date: from, balance: money(500000) },
          { date: "2026-10-17", balance: money(524055) },
        ],
      });
    },
    ...Object.fromEntries(
      accountFixtures.map((a) => [
        `GET /api/v1/accounts/${a.id}`,
        () => json(200, a),
      ]),
    ),
    ...overrides,
  };
}

export const openStatementID = "d1000000-0000-4000-8000-000000000011";
export const closedStatementID = "d1000000-0000-4000-8000-000000000010";

export function statement(
  id: string,
  reference: string,
  status: string,
  over: Record<string, unknown> = {},
) {
  const zero = money(0);
  return {
    id,
    account_id: cardID,
    reference,
    closing_date: `${reference}-05`,
    due_date: `${reference}-12`,
    opening: zero,
    charges: zero,
    credits: zero,
    amount_due: zero,
    payments: zero,
    settled: zero,
    unpaid: zero,
    prior_credits: zero,
    early_payments: zero,
    billed_amount: zero,
    open_amount: zero,
    status,
    reconciled: false,
    ...over,
  };
}

// The Itaú Visa: October's statement closed and unpaid, November's open.
export const statementFixtures = [
  statement(closedStatementID, "2026-10", "closed", {
    closing_date: "2026-10-05",
    due_date: "2026-10-25",
    opening: money(90000),
    charges: money(180000),
    amount_due: money(180000),
    payments: money(90000),
    unpaid: money(180000),
    billed_amount: money(180000),
  }),
  statement(openStatementID, "2026-11", "open", {
    closing_date: "2026-11-05",
    due_date: "2026-11-12",
    opening: money(180000),
    charges: money(250000),
    amount_due: money(250000),
    unpaid: money(250000),
    billed_amount: money(250000),
    open_amount: money(250000),
  }),
];

export function cardRoutes(): Record<string, Route> {
  return {
    [`GET /api/v1/accounts/${cardID}/statements`]: () =>
      json(200, { items: statementFixtures }),
    [`GET /api/v1/accounts/${cardID}/billing-cycle-rules`]: () =>
      json(200, {
        items: [
          {
            effective_from: "2026-01",
            closing_mode: "day",
            closing_day: 5,
            due_day: 12,
            closing_adjustment: "none",
            due_date_adjustment: "following",
            closing_day_assignment: "next",
          },
        ],
      }),
    [`GET /api/v1/accounts/${cardID}/credit-limits`]: () =>
      json(200, {
        items: [{ effective_from: "2026-01-01", amount: money(800000) }],
      }),
    [`GET /api/v1/accounts/${cardID}/cards`]: () =>
      json(200, {
        items: [
          {
            id: "pc1",
            holder: "Ana",
            last_four: "1234",
            virtual: false,
            active: true,
          },
          {
            id: "pc2",
            holder: "Ana",
            last_four: "9876",
            virtual: true,
            active: true,
          },
        ],
      }),
    [`GET /api/v1/accounts/${cardID}/commitments`]: (req) => {
      const month = new URL(req.url).searchParams.get("month") ?? "";
      return json(200, {
        month,
        amount: money(month <= "2027-01" ? 40000 : 0),
      });
    },
    // The week of 2026-10-17 (a Saturday): a payment on Tuesday, purchases on Tuesday and Friday.
    [`GET /api/v1/reports/flows`]: (req) => {
      const params = new URL(req.url).searchParams;
      if (params.get("account_id") !== cardID) return json(200, { items: [] });
      return json(200, {
        items: [
          { date: "2026-10-13", inflow: money(180000), outflow: money(4000) },
          { date: "2026-10-16", inflow: money(0), outflow: money(1500) },
        ].filter(
          (d) =>
            d.date >= (params.get("from") ?? "") &&
            d.date <= (params.get("to") ?? ""),
        ),
      });
    },
  };
}
