import { fakeApi, json } from "@/testing/fake-api";
import {
  accounts,
  brl,
  brokerID,
  cashID,
  securityID,
} from "@/testing/investment-api";
import { sharedRoutes } from "@/testing/transaction-api";

export const petrID = accounts.find((a) => a.name === "XP PETR4")?.id ?? "";

export const instruments = [
  { code: "BRL", type: "currency", scale: 2, name: "Real" },
  { code: "USD", type: "currency", scale: 2, name: "Dollar" },
  { code: "MXRF11", type: "reit", scale: 0, name: "MXRF11" },
  { code: "PETR4", type: "stock", scale: 0, name: "PETR4" },
];

// Three priced positions (10 500, 2 000 and 1 600 minor units, the last with its cost in USD)
// and one without a price.
export const positions = [
  {
    account_id: securityID,
    instrument: "MXRF11",
    quantity: { amount: 10, currency: "MXRF11" },
    cost_basis: brl(10000),
    average_cost: "10.0000",
    market_value: brl(10500),
  },
  {
    account_id: petrID,
    instrument: "PETR4",
    quantity: { amount: 5, currency: "PETR4" },
    cost_basis: brl(1500),
    average_cost: "3.0000",
    market_value: brl(2000),
  },
  {
    account_id: cashID,
    instrument: "MXRF11",
    quantity: { amount: 2, currency: "MXRF11" },
    cost_basis: brl(1000),
    average_cost: "5.0000",
  },
  {
    account_id: brokerID,
    instrument: "PETR4",
    quantity: { amount: 1, currency: "PETR4" },
    cost_basis: { amount: 300, currency: "USD" },
    average_cost: "3.0000",
    market_value: brl(1600),
  },
];

// S128: checking 500.00, XP cash 400.00 and 10 MXRF11 at 10.50.
export const allocations = {
  type: {
    total: brl(100500),
    groups: [
      { key: "currency", value: brl(90000), share_bp: 8955 },
      { key: "reit", value: brl(10500), share_bp: 1045 },
    ],
  },
  currency: {
    total: brl(100500),
    groups: [{ key: "BRL", value: brl(100500), share_bp: 10000 }],
  },
  institution: {
    total: brl(100500),
    groups: [
      { key: "XP", value: brl(50500), share_bp: 5024 },
      { key: "", value: brl(50000), share_bp: 4976 },
    ],
  },
};

// S126: the first answer of the scenario, 500 basis points, and the one with a contribution, 333.
export const plainReturn = {
  annual_bp: 500,
  flows: [],
  opening: brl(100000),
  closing: brl(105000),
};
export const contributionReturn = {
  annual_bp: 333,
  flows: [{ date: "2026-04-30", amount: brl(100000) }],
  opening: brl(100000),
  closing: brl(205000),
};

type Route = Parameters<typeof fakeApi>[0][string];

export function portfolioApi(routes: Record<string, Route> = {}) {
  return fakeApi({
    ...sharedRoutes,
    "GET /api/v1/accounts": () => json(200, { items: accounts }),
    "GET /api/v1/instruments": () => json(200, { items: instruments }),
    "GET /api/v1/positions": () => json(200, { items: positions }),
    "GET /api/v1/reports/allocation": (req) =>
      json(
        200,
        allocations[
          new URL(req.url).searchParams.get("by") as keyof typeof allocations
        ],
      ),
    "GET /api/v1/reports/return": () => json(200, plainReturn),
    ...routes,
  });
}
