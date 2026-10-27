import type { components } from "@/api/schema.gen";
import { accountFixtures, money } from "@/testing/account-api";
import { json } from "@/testing/fake-api";
import { planningApi } from "@/testing/planning-api";

type Route = (req: Request) => Response | Promise<Response>;
type BudgetPlan = components["schemas"]["BudgetPlan"];

const base = { currency: "BRL", opened_on: "2026-01-01", yield_mode: "none" };

function category(n: number, name: string, parent?: { id: string }) {
  return {
    ...base,
    id: `cb000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`,
    name,
    class: "expense",
    ...(parent === undefined ? {} : { parent_id: parent.id }),
  };
}

export const housing = category(1, "Housing");
export const rent = category(2, "Rent", housing);
export const condo = category(3, "Condo", housing);
export const energy = category(4, "Energy", housing);
export const food = category(5, "Food");
export const market = category(6, "Market", food);
export const restaurants = category(7, "Restaurants", food);
export const transport = category(8, "Transport");
export const fuel = category(9, "Fuel", transport);
export const apps = category(10, "Apps", transport);
export const leisure = category(11, "Leisure");
export const streaming = category(12, "Streaming", leisure);
export const outings = category(13, "Outings", leisure);
export const health = category(14, "Health");
export const pets = category(15, "Pets");
export const gifts = category(16, "Gifts");
export const planCategories = [
  housing,
  rent,
  condo,
  energy,
  food,
  market,
  restaurants,
  transport,
  fuel,
  apps,
  leisure,
  streaming,
  outings,
  health,
  pets,
  gifts,
];

function row(
  c: { id: string },
  planned: number | undefined,
  lastMonth: number,
  average: number,
): components["schemas"]["BudgetPlanRow"] {
  return {
    category_id: c.id,
    ...(planned === undefined ? {} : { budget_id: `bb${c.id.slice(2)}` }),
    planned: money(planned ?? 0),
    last_month: money(lastMonth),
    average: money(average),
    counted: true,
  };
}

// The design's sample month: 8,500.00 of expected income, 640.00 of installments and
// 5,700.00 of budgets leave 2,160.00 to distribute.
export const planRows = [
  row(rent, 220000, 220000, 220000),
  row(condo, 45000, 45000, 45000),
  row(energy, 18000, 19200, 20500),
  row(market, 110000, 120500, 124000),
  row(restaurants, 40000, 48500, 52000),
  row(fuel, 35000, 30000, 31000),
  row(apps, 15000, 17000, 18000),
  row(streaming, 9000, 9000, 9000),
  row(outings, 30000, 36500, 41000),
  row(health, 48000, 48000, 48000),
  row(pets, undefined, 18000, 21000),
  row(gifts, undefined, 11500, 12000),
];

export function budgetPlan(
  month: string,
  overrides: Partial<BudgetPlan> = {},
): BudgetPlan {
  const plan: BudgetPlan = {
    month,
    currency: "BRL",
    source: "expected_income",
    expected_income: money(850000),
    expected_items: [
      {
        schedule_id: "5c000000-0000-4000-8000-000000000001",
        description: "Salary",
        amount: money(720000),
      },
      {
        schedule_id: "5c000000-0000-4000-8000-000000000002",
        description: "Freelance",
        amount: money(130000),
      },
    ],
    average_income: money(812000),
    average_months: 3,
    received_income: money(720000),
    reference: money(850000),
    installments: money(64000),
    savings: money(0),
    planned: money(570000),
    unassigned: money(216000),
    rows: planRows,
    ...overrides,
  };
  return plan;
}

export function budgetPlanApi(
  plan: (month: string) => BudgetPlan = (month) => budgetPlan(month),
  overrides: Record<string, Route> = {},
) {
  return planningApi({
    "GET /api/v1/accounts": () =>
      json(200, { items: [...accountFixtures, ...planCategories] }),
    "GET /api/v1/budget-plan": (req: Request) =>
      json(200, plan(new URL(req.url).searchParams.get("month") ?? "")),
    "PUT /api/v1/budget-plan": (req: Request) =>
      json(200, plan(new URL(req.url).searchParams.get("month") ?? "")),
    "GET /api/v1/budgets": () => json(200, { items: [] }),
    "GET /api/v1/reports/categories": () => json(200, { items: [] }),
    ...overrides,
  });
}
