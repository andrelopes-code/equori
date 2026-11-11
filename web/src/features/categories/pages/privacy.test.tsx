import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { MASK } from "@/privacy/mask";
import { fakeApi, json } from "@/testing/fake-api";
import { expectNoAmounts, hideAmounts } from "@/testing/privacy";
import { renderApp } from "@/testing/render-app";
import { sharedRoutes } from "@/testing/transaction-api";

const base = { currency: "BRL", opened_on: "2026-01-01", yield_mode: "none" };
const accounts = [
  { ...base, id: "food", name: "Food", class: "expense" },
  {
    ...base,
    id: "groceries",
    name: "Groceries",
    class: "expense",
    parent_id: "food",
  },
  { ...base, id: "fun", name: "Fun", class: "expense" },
];
const money = (amount: number) => ({ amount, currency: "BRL" });

const bigSpender = {
  id: "r1",
  name: "Big spender",
  priority: 1,
  enabled: true,
  stop_processing: false,
  categorized_count: 3,
  conditions: [
    { field: "amount", operator: "greater_than", value: money(123456) },
  ],
  actions: [{ type: "set_category", category_id: "fun" }],
};

function api() {
  return fakeApi({
    ...sharedRoutes,
    "GET /api/v1/accounts": () => json(200, { items: accounts }),
    "GET /api/v1/rules": () => json(200, { items: [bigSpender] }),
    "GET /api/v1/rule-suggestions": () => json(200, { items: [] }),
    "GET /api/v1/reports/categories": () =>
      json(200, {
        items: [
          {
            account_id: "food",
            total: money(5000),
            subtree_total: money(30000),
          },
          {
            account_id: "groceries",
            total: money(25000),
            subtree_total: money(25000),
          },
          {
            account_id: "fun",
            total: money(10000),
            subtree_total: money(10000),
          },
        ],
      }),
  });
}

async function settle() {
  await waitFor(() => {
    expect(screen.queryAllByRole("progressbar")).toHaveLength(0);
  });
}

beforeEach(() => {
  localStorage.clear();
});

describe("categories with the amounts hidden", () => {
  it("masks the figures, the charts and the tree", async () => {
    hideAmounts();
    const { container } = await renderApp("/categories", {
      fetch: api(),
      today: "2026-10-17",
    });
    await screen.findAllByText("Groceries");
    await settle();
    expect(screen.getAllByText(new RegExp(MASK)).length).toBeGreaterThan(0);
    expectNoAmounts(container, ["300.00", "250.00", "100.00"]);
  });

  it("masks an amount written in the words of a rule", async () => {
    hideAmounts();
    const { container } = await renderApp("/categories/rules", {
      fetch: api(),
      today: "2026-10-17",
    });
    await screen.findByText("Big spender");
    await settle();
    expectNoAmounts(container, ["1,234.56"]);
  });
});
