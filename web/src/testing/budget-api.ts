import { accountFixtures, money } from "@/testing/account-api";
import { json } from "@/testing/fake-api";
import { planningApi } from "@/testing/planning-api";

type Route = (req: Request) => Response | Promise<Response>;

const base = { currency: "BRL", opened_on: "2026-01-01", yield_mode: "none" };

function category(id: string, name: string, parent?: string) {
  return {
    ...base,
    id: `ca000000-0000-4000-8000-00000000000${id}`,
    name,
    class: "expense",
    ...(parent === undefined ? {} : { parent_id: parent }),
  };
}

export const food = category("1", "Food");
export const supermarket = category("2", "Supermarket", food.id);
export const restaurant = category("3", "Restaurant", food.id);
export const transport = category("4", "Transport");
export const fuel = category("5", "Fuel", transport.id);
export const parking = category("6", "Parking", transport.id);
export const health = category("7", "Health");
export const gifts = category("8", "Gifts");
export const categories = [
  food,
  supermarket,
  restaurant,
  transport,
  fuel,
  parking,
  health,
  gifts,
];

function budget(
  id: string,
  categoryID: string,
  rollover: boolean,
  amounts: [string, number][],
) {
  return {
    id: `bd000000-0000-4000-8000-00000000000${id}`,
    category_id: categoryID,
    rollover,
    amounts: amounts.map(([from, amount]) => ({
      effective_from: from,
      amount: money(amount),
    })),
  };
}

// S60: Food 1,800.00 from 2026-10 with rollover, 2,000.00 from 2026-12.
export const foodBudget = budget("1", food.id, true, [
  ["2026-10", 180000],
  ["2026-12", 200000],
]);
export const fuelBudget = budget("2", fuel.id, false, [["2026-10", 40000]]);
export const parkingBudget = budget("3", parking.id, false, [
  ["2026-10", 10000],
]);
// Starts after the months the tests read: its progress is never asked for them.
export const giftsBudget = budget("4", gifts.id, false, [["2027-01", 30000]]);
export const budgets = [foodBudget, fuelBudget, parkingBudget, giftsBudget];

function progress(
  month: string,
  planned: number,
  carried: number,
  spent: number,
) {
  return {
    month,
    planned: money(planned),
    carried: money(carried),
    spent: money(spent),
    available: money(planned + carried - spent),
  };
}

// The progress of each budget by month; S60 for Food.
export const progressByBudget: Record<
  string,
  Record<string, ReturnType<typeof progress>>
> = {
  [foodBudget.id]: {
    "2026-10": progress("2026-10", 180000, 0, 150000),
    "2026-11": progress("2026-11", 180000, 30000, 230000),
    "2026-12": progress("2026-12", 200000, -20000, 0),
  },
  [fuelBudget.id]: {
    "2026-10": progress("2026-10", 40000, 0, 35000),
    "2026-11": progress("2026-11", 40000, 0, 10000),
    "2026-12": progress("2026-12", 40000, 0, 0),
  },
  [parkingBudget.id]: {
    "2026-10": progress("2026-10", 10000, 0, 4000),
    "2026-11": progress("2026-11", 10000, 0, 5000),
    "2026-12": progress("2026-12", 10000, 0, 0),
  },
};

// The month's own totals of each expense category.
export const totals = [
  { account_id: supermarket.id, total: 150000, subtree: 150000 },
  { account_id: restaurant.id, total: 80000, subtree: 80000 },
  { account_id: food.id, total: 0, subtree: 230000 },
  { account_id: fuel.id, total: 10000, subtree: 10000 },
  { account_id: parking.id, total: 5000, subtree: 5000 },
  { account_id: transport.id, total: 0, subtree: 15000 },
  { account_id: health.id, total: 12000, subtree: 12000 },
].map((t) => ({
  account_id: t.account_id,
  total: money(t.total),
  subtree_total: money(t.subtree),
}));

// S66: a subscription of 9.99 USD valued at USD/BRL 5.5000.
export const committed = {
  month: "2026-11",
  installments: money(33333),
  occurrences: money(5494),
  total: money(38827),
  prices: [
    {
      instrument: "USD",
      quote_instrument: "BRL",
      date: "2026-10-30",
      value: "5.5000",
      source: "bcb_ptax",
    },
  ],
};

export function budgetApi(overrides: Record<string, Route> = {}) {
  return planningApi({
    "GET /api/v1/accounts": () =>
      json(200, { items: [...accountFixtures, ...categories] }),
    "GET /api/v1/budgets": () => json(200, { items: budgets }),
    ...Object.fromEntries(
      budgets.flatMap((b) => [
        [`GET /api/v1/budgets/${b.id}`, () => json(200, b)],
        [
          `GET /api/v1/budgets/${b.id}/progress`,
          (req: Request) => {
            const month = new URL(req.url).searchParams.get("month") ?? "";
            const p = progressByBudget[b.id]?.[month];
            return p === undefined
              ? json(422, { status: 422, code: "validation" })
              : json(200, p);
          },
        ],
      ]),
    ),
    "GET /api/v1/reports/categories": () => json(200, { items: totals }),
    "GET /api/v1/commitments": () => json(200, committed),
    ...overrides,
  });
}
