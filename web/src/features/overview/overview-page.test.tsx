import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { fakeApi, json, problem } from "@/testing/fake-api";
import { expectNoAmounts, hideAmounts } from "@/testing/privacy";
import { renderApp } from "@/testing/render-app";
import {
  accountFixtures,
  accountRoutes,
  checkingID,
  foodID,
  money,
} from "@/testing/account-api";

const incomeID = "a1000000-0000-4000-8000-0000000000f1";
const accounts = [
  ...accountFixtures,
  {
    ...accountFixtures[0],
    id: incomeID,
    name: "Salário",
    class: "income",
    kind: undefined,
    institution_id: undefined,
  },
];

const categoryNames = [
  "Rent",
  "Food",
  "Fuel",
  "Health",
  "Gifts",
  "Travel",
  "Pets",
];
const categoryAccounts = categoryNames.map((name, i) => ({
  ...accountFixtures[0],
  id: `cat-${String(i)}`,
  name,
  class: "expense",
  kind: undefined,
  institution_id: undefined,
}));

function tx(postings: [string, number][]) {
  return {
    id: "t",
    date: "2026-10-05",
    postings: postings.map(([account_id, amount]) => ({
      account_id,
      amount: money(amount),
    })),
  };
}

function netWorth(req: Request) {
  const date = new URL(req.url).searchParams.get("date");
  // S129 at the end of September, 150.00 less than today.
  const assets = date === "2026-09-30" ? 205500 : 220500;
  return json(200, {
    assets: money(assets),
    liabilities: money(120000),
    net: money(assets - 120000),
  });
}

function api(overrides: Record<string, (req: Request) => Response> = {}) {
  return fakeApi({
    ...accountRoutes({
      "GET /api/v1/accounts": () =>
        json(200, { items: [...accounts, ...categoryAccounts] }),
    }),
    ...Object.fromEntries(
      accountFixtures.map((a) => [
        `GET /api/v1/accounts/${a.id}/projection`,
        () => json(200, { opening: money(0), points: [] }),
      ]),
    ),
    "GET /api/v1/budgets": () => json(200, { items: [] }),
    "GET /api/v1/reports/net-worth": netWorth,
    "GET /api/v1/reports/categories": () =>
      json(200, {
        items: categoryAccounts.map((a, i) => ({
          account_id: a.id,
          total: money((i + 1) * 1000),
          subtree_total: money((i + 1) * 1000),
        })),
      }),
    "GET /api/v1/transactions": () =>
      json(200, {
        items: [
          tx([
            [checkingID, 100000],
            [incomeID, -100000],
          ]),
          tx([
            [checkingID, -2500],
            [foodID, 2500],
          ]),
        ],
      }),
    ...overrides,
  });
}

beforeEach(() => {
  localStorage.clear();
});

function block(name: string) {
  return screen.getByRole("region", { name });
}

describe("overview page", () => {
  it("S129: shows assets, liabilities, net and the change against the previous month end", async () => {
    await renderApp("/", { fetch: api() });
    const worth = await screen.findByRole("region", { name: "Net worth" });
    await waitFor(() => {
      expect(worth).toHaveTextContent("2,205.00");
    });
    expect(worth).toHaveTextContent("1,200.00");
    expect(worth).toHaveTextContent("1,005.00");
    expect(worth).toHaveTextContent("+17.5%");
  });

  it("shows the income, outflow and result of the month", async () => {
    await renderApp("/", { fetch: api() });
    const flows = await screen.findByRole("region", { name: "Month flows" });
    await waitFor(() => {
      expect(flows).toHaveTextContent("1,000.00");
    });
    expect(flows).toHaveTextContent("25.00");
    expect(flows).toHaveTextContent("975.00");
  });

  it("lists the five largest categories of the month", async () => {
    await renderApp("/", { fetch: api() });
    const spending = await screen.findByRole("region", {
      name: "Spending by category",
    });
    await waitFor(() => {
      expect(within(spending).getAllByRole("listitem")).toHaveLength(5);
    });
    const names = within(spending)
      .getAllByRole("listitem")
      .map((item) => item.textContent);
    expect(names[0]).toContain("Pets");
    expect(names[4]).toContain("Fuel");
    expect(spending).not.toHaveTextContent("Rent");
    expect(spending).not.toHaveTextContent("Food");
  });

  it("keeps the other blocks when one operation fails", async () => {
    await renderApp("/", {
      fetch: api({
        "GET /api/v1/reports/net-worth": () => problem(500, "internal_error"),
      }),
    });
    const worth = await screen.findByRole("region", { name: "Net worth" });
    await within(worth).findByRole("button", { name: "Try again" });
    const spending = await screen.findByRole("region", {
      name: "Spending by category",
    });
    await waitFor(() => {
      expect(spending).toHaveTextContent("Pets");
    });
  });

  it("masks every amount in privacy mode", async () => {
    hideAmounts();
    const { container } = await renderApp("/", { fetch: api() });
    const spending = await screen.findByRole("region", {
      name: "Spending by category",
    });
    await waitFor(() => {
      expect(spending).toHaveTextContent("Pets");
    });
    await waitFor(() => {
      expect(block("Net worth")).toHaveTextContent("•");
    });
    expectNoAmounts(container, ["2,205.00", "1,005.00", "975.00"]);
  });

  it("puts the attention list before the figures on a phone", async () => {
    await renderApp("/", { fetch: api(), width: 390 });
    const attention = await screen.findByRole("region", { name: "Attention" });
    const worth = await screen.findByRole("region", { name: "Net worth" });
    expect(
      attention.compareDocumentPosition(worth) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
