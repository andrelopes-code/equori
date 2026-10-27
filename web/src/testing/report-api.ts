import type { components } from "@/api/schema.gen";
import { json } from "@/testing/fake-api";
import {
  accounts as sharedAccounts,
  sharedRoutes,
} from "@/testing/transaction-api";

export const brl = (amount: number) => ({ amount, currency: "BRL" });

// S129 today: assets 2,205.00, liabilities 1,200.00, net 1,005.00; the end of September held
// 150.00 less; every earlier month ends at net 800.00.
export function netWorthAt(date: string) {
  const assets =
    date === "2026-10-17" ? 220500 : date === "2026-09-30" ? 205500 : 200000;
  return {
    assets: brl(assets),
    liabilities: brl(120000),
    net: brl(assets - 120000),
  };
}

export function reportApiRoutes() {
  return {
    ...sharedRoutes,
    "GET /api/v1/instruments": () =>
      json(200, {
        items: [
          { code: "BRL", type: "currency", scale: 2, name: "Real" },
          { code: "USD", type: "currency", scale: 2, name: "Dollar" },
        ],
      }),
    "GET /api/v1/reports/net-worth": (req: Request) =>
      json(200, netWorthAt(new URL(req.url).searchParams.get("date") ?? "")),
  };
}

const expenseBase = {
  currency: "BRL",
  opened_on: "2026-01-01",
  yield_mode: "none",
};
export const foodID = "ca000000-0000-4000-8000-000000000001";
export const marketID = "ca000000-0000-4000-8000-000000000002";
export const dinerID = "ca000000-0000-4000-8000-000000000003";
export const transportID = "ca000000-0000-4000-8000-000000000004";
export const fuelID = "ca000000-0000-4000-8000-000000000005";
export const healthID = "ca000000-0000-4000-8000-000000000006";
export const salaryID = "ca000000-0000-4000-8000-0000000000a1";

export const categoryAccounts = [
  { ...expenseBase, id: foodID, name: "Food", class: "expense" },
  {
    ...expenseBase,
    id: marketID,
    name: "Market",
    class: "expense",
    parent_id: foodID,
  },
  {
    ...expenseBase,
    id: dinerID,
    name: "Diner",
    class: "expense",
    parent_id: foodID,
  },
  { ...expenseBase, id: transportID, name: "Transport", class: "expense" },
  {
    ...expenseBase,
    id: fuelID,
    name: "Fuel",
    class: "expense",
    parent_id: transportID,
  },
  { ...expenseBase, id: healthID, name: "Health", class: "expense" },
  { ...expenseBase, id: salaryID, name: "Salary", class: "income" },
];

const item = (id: string, total: number, subtree: number) => ({
  account_id: id,
  total: brl(total),
  subtree_total: brl(subtree),
});

// October 2026: Food 90.00 (10.00 held itself, Market 50.00, Diner 30.00), Transport 40.00 and
// Health 25.00. September 2026: Food 60.00, Transport 50.00. Salary: 3,000.00 in both.
export function categoryTotalsAt(from: string, cls: string) {
  if (cls === "income") return { items: [item(salaryID, 300000, 300000)] };
  if (from === "2026-09-01")
    return {
      items: [
        item(foodID, 0, 6000),
        item(marketID, 6000, 6000),
        item(transportID, 0, 5000),
        item(fuelID, 5000, 5000),
      ],
    };
  return {
    items: [
      item(foodID, 1000, 9000),
      item(marketID, 5000, 5000),
      item(dinerID, 3000, 3000),
      item(transportID, 0, 4000),
      item(fuelID, 4000, 4000),
      item(healthID, 2500, 2500),
    ],
  };
}

export function categoryReportRoutes() {
  return {
    ...reportApiRoutes(),
    "GET /api/v1/accounts": () => json(200, { items: categoryAccounts }),
    "GET /api/v1/reports/categories": (req: Request) => {
      const q = new URL(req.url).searchParams;
      return json(
        200,
        categoryTotalsAt(q.get("from") ?? "", q.get("class") ?? ""),
      );
    },
  };
}

export const checkingAccountID = "11111111-1111-4111-8111-111111111111";
export const savingsAccountID = "88888888-8888-4888-8888-888888888888";
export const visaID = "99999999-9999-4999-8999-999999999999";

const flowDay = (date: string, inflow: number, outflow: number) => ({
  date,
  inflow: brl(inflow),
  outflow: brl(outflow),
});

// S115 on the checking account: 2026-10-05 inflow 1,000.00 and outflow 125.00; 2026-10-07
// outflow 8.00. A day in September adds 50.00 of inflow.
const checkingDays = [
  flowDay("2026-09-20", 5000, 0),
  flowDay("2026-10-05", 100000, 12500),
  flowDay("2026-10-07", 0, 800),
];

export function flowReportRoutes() {
  return {
    ...reportApiRoutes(),
    "GET /api/v1/accounts": () =>
      json(200, {
        items: [
          ...sharedAccounts,
          {
            id: visaID,
            name: "Visa",
            class: "liability",
            kind: "credit_card",
            currency: "BRL",
          },
        ],
      }),
    "GET /api/v1/reports/flows": (req: Request) => {
      const q = new URL(req.url).searchParams;
      const from = q.get("from") ?? "";
      const to = q.get("to") ?? "";
      const days =
        q.get("account_id") === checkingAccountID ? checkingDays : [];
      return json(200, {
        items: days.filter((d) => d.date >= from && d.date <= to),
      });
    },
  };
}

type IndicatorMonth = components["schemas"]["IndicatorMonth"];
type Indicators = components["schemas"]["Indicators"];

const indicatorMonths = [
  "2025-11",
  "2025-12",
  "2026-01",
  "2026-02",
  "2026-03",
  "2026-04",
  "2026-05",
  "2026-06",
  "2026-07",
  "2026-08",
  "2026-09",
  "2026-10",
];
const savingsRates = [
  ...Array<{ reason: "no_income" }>(5).fill({ reason: "no_income" }),
  { bp: 5000 },
  { bp: 5000 },
  { bp: 5000 },
  { bp: 4300 },
  { bp: 4300 },
  { bp: 4300 },
  { bp: 4300 },
];
const trailingRates = [
  ...Array<{ reason: "insufficient_history" }>(8).fill({
    reason: "insufficient_history",
  }),
  { bp: 5000 },
  { bp: 4825 },
  { bp: 4720 },
  { bp: 4650 },
];

// S154: 12 months from 2025-11 to 2026-10; last overrides fields of the last entry.
export function indicatorsFixture(
  last: Partial<IndicatorMonth> = {},
): Indicators {
  const short = { reason: "insufficient_history" } as const;
  const months: IndicatorMonth[] = indicatorMonths.map((month, i) => ({
    month,
    income: brl(0),
    expense: brl(0),
    committed: brl(0),
    debt_service: brl(0),
    liquid_balance: brl(0),
    liabilities: brl(0),
    savings_rate: savingsRates[i] ?? short,
    trailing_savings_rate: trailingRates[i] ?? short,
    liquidity: short,
    committed_share: short,
    debt_service_share: short,
  }));
  const lastEntry = {
    income: brl(500000),
    expense: brl(285000),
    committed: brl(5000),
    debt_service: brl(125000),
    liquid_balance: brl(1790000),
    liabilities: brl(640000),
    mean_income: brl(500000),
    mean_expense: brl(267500),
    liquidity: { bp: 66915 },
    committed_share: { bp: 100 },
    debt_service_share: { bp: 2500 },
    ...last,
  };
  return {
    currency: "BRL",
    months: months.map((m, i) => (i === 11 ? { ...m, ...lastEntry } : m)),
  };
}
