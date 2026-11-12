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

// A second open cash account of the XP brokerage.
export const secondCash = {
  id: secondCashID,
  name: "XP reserve",
  class: "asset",
  currency: "BRL",
  parent_id: brokerID,
};

export const brl = (amount: number) => ({ amount, currency: "BRL" });

export function investmentApi(
  sent: unknown[],
  options: {
    price?: string;
    held?: { quantity: number; cost: number };
    extraAccounts?: unknown[];
    cashBalance?: number;
    // Booked balances of other accounts by id, in minor units of BRL.
    balances?: Record<string, number>;
    answer?: () => Response;
    incomeTypes?: string[];
    incomeAnswer?: () => Response;
  } = {},
) {
  return fakeApi({
    ...sharedRoutes,
    "GET /api/v1/accounts": () =>
      json(200, { items: [...accounts, ...(options.extraAccounts ?? [])] }),
    [`GET /api/v1/accounts/${cashID}/balance`]: (req) =>
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
    "GET /api/v1/prices": (req) => {
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
    "POST /api/v1/investment-income": async (req) => {
      sent.push(await req.json());
      return (
        options.incomeAnswer ??
        (() => json(201, transactionFixture({ id: txID })))
      )();
    },
    "POST /api/v1/trades": async (req) => {
      sent.push(await req.json());
      return (
        options.answer ?? (() => json(201, transactionFixture({ id: txID })))
      )();
    },
  });
}
