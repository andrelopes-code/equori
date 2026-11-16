import { fakeApi, json } from "@/testing/fake-api";
import {
  accounts as baseAccounts,
  sharedRoutes,
  transactionFixture,
  txID,
} from "@/testing/transaction-api";

export const dividendsID = "b0000000-0000-4000-8000-000000000007";
export const brokerID = "b0000000-0000-4000-8000-000000000001";
export const cashID = "b0000000-0000-4000-8000-000000000002";
export const securityID = "b0000000-0000-4000-8000-000000000003";
const otherSecurityID = "b0000000-0000-4000-8000-000000000004";
const closedCashID = "b0000000-0000-4000-8000-000000000005";
export const taxID = "b0000000-0000-4000-8000-000000000006";
export const usdBrokerID = "b0000000-0000-4000-8000-000000000008";
export const secondCashID = "b0000000-0000-4000-8000-000000000009";
export const clearID = "b0000000-0000-4000-8000-00000000000b";

export const accounts = [
  ...baseAccounts,
  {
    id: brokerID,
    name: "XP",
    class: "asset",
    kind: "brokerage",
    currency: "BRL",
  },
  {
    id: cashID,
    name: "XP cash",
    class: "asset",
    currency: "BRL",
    parent_id: brokerID,
  },
  {
    id: closedCashID,
    name: "XP old cash",
    class: "asset",
    currency: "BRL",
    parent_id: brokerID,
    closed_on: "2026-01-01",
  },
  {
    id: securityID,
    name: "XP MXRF11",
    class: "asset",
    currency: "MXRF11",
    parent_id: brokerID,
  },
  {
    id: otherSecurityID,
    name: "XP PETR4",
    class: "asset",
    currency: "PETR4",
    parent_id: brokerID,
  },
  { id: taxID, name: "Income tax", class: "expense", currency: "BRL" },
  { id: dividendsID, name: "Dividends", class: "income", currency: "BRL" },
];

// A brokerage in USD with no cash account in the base currency.
export const usdBrokerage = [
  {
    id: usdBrokerID,
    name: "Alpha",
    class: "asset",
    kind: "brokerage",
    currency: "USD",
  },
  {
    id: "b0000000-0000-4000-8000-00000000000a",
    name: "Alpha USD",
    class: "asset",
    currency: "USD",
    parent_id: usdBrokerID,
  },
];

// A second brokerage with a cash account, the receiver of a custody transfer.
export const clearBrokerage = [
  {
    id: clearID,
    name: "Clear",
    class: "asset",
    kind: "brokerage",
    currency: "BRL",
  },
  {
    id: "b0000000-0000-4000-8000-00000000000c",
    name: "Clear cash",
    class: "asset",
    currency: "BRL",
    parent_id: clearID,
  },
];

// A second open cash account of the XP brokerage.
export const secondCash = {
  id: secondCashID,
  name: "XP reserve",
  class: "asset",
  currency: "BRL",
  parent_id: brokerID,
};

export const brl = (amount: number) => ({ amount, currency: "BRL" });

export interface InvestmentOptions {
  price?: string;
  held?: { quantity: number; cost: number };
  extraAccounts?: unknown[];
  cashBalance?: number;
  // Open purchase lots of the security account, oldest first: the account then sells by lot
  // (A234). Without it the account sells at the average cost.
  lots?: { acquired_on: string; quantity: number; cost: number }[];
  // The tax a sale of the security withholds (A235); without it the account has no estimate.
  withholding?: { incomeTax: number; iof: number };
  // Booked balances of other accounts by id, in minor units of BRL.
  balances?: Record<string, number>;
  answer?: () => Response;
  incomeTypes?: string[];
  incomeAnswer?: () => Response;
  noteAnswer?: () => Response;
  actionAnswer?: () => Response;
  custodyAnswer?: () => Response;
}

export function investmentApi(
  sent: unknown[],
  options: InvestmentOptions = {},
) {
  return fakeApi(investmentRoutes(sent, options));
}

// The routes of investmentApi, for a test that adds its own.
export function investmentRoutes(
  sent: unknown[],
  options: InvestmentOptions = {},
) {
  return {
    ...sharedRoutes,
    "GET /api/v1/accounts": () =>
      json(200, { items: [...accounts, ...(options.extraAccounts ?? [])] }),
    [`GET /api/v1/accounts/${securityID}/withholding`]: (req: Request) =>
      options.withholding === undefined
        ? json(422, {
            type: "about:blank",
            title: "Unprocessable Entity",
            status: 422,
            code: "validation_failed",
          })
        : json(200, {
            account_id: securityID,
            date: new URL(req.url).searchParams.get("date"),
            income_tax: brl(options.withholding.incomeTax),
            iof: brl(options.withholding.iof),
            net: brl(0),
          }),
    [`GET /api/v1/accounts/${securityID}/lots`]: (req: Request) =>
      json(200, {
        account_id: securityID,
        date: new URL(req.url).searchParams.get("date"),
        method: options.lots === undefined ? "average" : "fifo",
        quantity: { amount: options.held?.quantity ?? 0, currency: "MXRF11" },
        cost_basis: brl(options.held?.cost ?? 0),
        lots: (options.lots ?? []).map((l) => ({
          acquired_on: l.acquired_on,
          quantity: { amount: l.quantity, currency: "MXRF11" },
          cost: brl(l.cost),
        })),
      }),
    [`GET /api/v1/accounts/${cashID}/balance`]: (req: Request) =>
      json(200, {
        account_id: cashID,
        date: new URL(req.url).searchParams.get("date"),
        basis: "booked",
        balance: brl(options.cashBalance ?? 100000000),
      }),
    ...Object.fromEntries(
      Object.entries(options.balances ?? {}).map(([id, amount]) => [
        `GET /api/v1/accounts/${id}/balance`,
        (req: Request) =>
          json(200, {
            account_id: id,
            date: new URL(req.url).searchParams.get("date"),
            basis: "booked",
            balance: brl(amount),
          }),
      ]),
    ),
    "GET /api/v1/instruments": () =>
      json(200, {
        items: [
          { code: "BRL", type: "currency", scale: 2, name: "Real" },
          { code: "MXRF11", type: "reit", scale: 0, name: "MXRF11" },
          { code: "PETR4", type: "stock", scale: 0, name: "PETR4" },
          { code: "HGLG11", type: "reit", scale: 0, name: "CSHG Logística" },
        ],
      }),
    "GET /api/v1/prices": (req: Request) => {
      const query = new URL(req.url).searchParams;
      return json(200, {
        items:
          options.price === undefined
            ? []
            : [
                {
                  instrument: query.get("instrument"),
                  quote_instrument: query.get("quote_instrument"),
                  date: query.get("from"),
                  value: options.price,
                  source: "b3_cotahist",
                },
              ],
      });
    },
    "GET /api/v1/positions": () =>
      json(200, {
        items:
          options.held === undefined
            ? []
            : [
                {
                  account_id: securityID,
                  instrument: "MXRF11",
                  quantity: {
                    amount: options.held.quantity,
                    currency: "MXRF11",
                  },
                  cost_basis: brl(options.held.cost),
                  average_cost: "10.0827",
                },
              ],
      }),
    "GET /api/v1/investment-income-types": () =>
      json(200, {
        items: options.incomeTypes ?? ["dividend", "jcp", "interest", "coupon"],
      }),
    "POST /api/v1/investment-income": async (req: Request) => {
      sent.push(await req.json());
      return (
        options.incomeAnswer ??
        (() => json(201, transactionFixture({ id: txID })))
      )();
    },
    "POST /api/v1/brokerage-notes": async (req: Request) => {
      sent.push(await req.json());
      return (
        options.noteAnswer ??
        (() => json(201, { transactions: [transactionFixture({ id: txID })] }))
      )();
    },
    "POST /api/v1/corporate-actions": async (req: Request) => {
      sent.push(await req.json());
      return (
        options.actionAnswer ??
        (() => json(201, transactionFixture({ id: txID })))
      )();
    },
    "POST /api/v1/custody-transfers": async (req: Request) => {
      sent.push(await req.json());
      return (
        options.custodyAnswer ??
        (() => json(201, transactionFixture({ id: txID })))
      )();
    },
    "POST /api/v1/trades": async (req: Request) => {
      sent.push(await req.json());
      return (
        options.answer ?? (() => json(201, transactionFixture({ id: txID })))
      )();
    },
  };
}
