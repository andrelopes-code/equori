import { json } from "@/testing/fake-api";

export const txID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const checkingID = "11111111-1111-4111-8111-111111111111";
export const foodID = "22222222-2222-4222-8222-222222222222";
export const leisureID = "77777777-7777-4777-8777-777777777777";
export const savingsID = "88888888-8888-4888-8888-888888888888";
export const payeeID = "44444444-4444-4444-8444-444444444444";

export const accounts = [
  {
    id: checkingID,
    name: "Itau",
    class: "asset",
    kind: "checking",
    currency: "BRL",
  },
  {
    id: savingsID,
    name: "Reserva",
    class: "asset",
    kind: "savings",
    currency: "BRL",
  },
  { id: foodID, name: "Mercado", class: "expense", currency: "BRL" },
  { id: leisureID, name: "Lazer", class: "expense", currency: "BRL" },
];

export function transactionFixture(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const money = (amount: number) => ({ amount, currency: "BRL" });
  return {
    id: txID,
    date: "2026-10-10",
    description: "Weekly shop",
    payee_id: payeeID,
    balancing_currency: "BRL",
    origin: "manual",
    version: 3,
    tags: ["food"],
    links: [],
    postings: [
      {
        id: "p1",
        account_id: checkingID,
        amount: money(-12000),
        weight: money(-12000),
        status: "cleared",
      },
      {
        id: "p2",
        account_id: foodID,
        amount: money(12000),
        weight: money(12000),
        status: "pending",
      },
    ],
    ...overrides,
  };
}

// Routes every page that loads a transaction needs besides the transaction itself.
export const sharedRoutes = {
  "GET /api/v1/me": () => json(200, { id: 1, email: "a@b.c", role: "admin" }),
  "GET /api/v1/settings": () => json(200, { base_currency: "BRL" }),
  "GET /api/v1/instruments": () =>
    json(200, {
      items: [{ code: "BRL", type: "currency", scale: 2, name: "Real" }],
    }),
  "GET /api/v1/accounts": () => json(200, { items: accounts }),
  "GET /api/v1/payees": () =>
    json(200, { items: [{ id: payeeID, name: "Padaria" }] }),
  "GET /api/v1/tags": () => json(200, { items: [] }),
  "GET /api/v1/transactions": () => json(200, { items: [] }),
};
