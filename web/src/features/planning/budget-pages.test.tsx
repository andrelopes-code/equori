import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { formatMonthTitle } from "@/i18n/format";
import { money } from "@/testing/account-api";
import {
  budgetApi,
  food,
  foodBudget,
  fuel,
  progressByBudget,
} from "@/testing/budget-api";
import { json, problem } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

async function pick(label: string, text: string) {
  const input = screen.getByRole("combobox", { name: label });
  await userEvent.click(input);
  await userEvent.type(input, text);
  await waitFor(() => {
    expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
  });
  await userEvent.keyboard("{ArrowDown}{Enter}");
}

async function fill(category: string, amount: string) {
  await userEvent.type(
    await screen.findByRole("textbox", { name: catalogEn["budget.amount"] }),
    amount,
  );
  await pick(catalogEn["budget.category"], category);
}

describe("Budget form", () => {
  it("creates a budget from the current month and opens it", async () => {
    const sent: unknown[] = [];
    const { router } = await renderApp("/planning/budgets/new", {
      fetch: budgetApi({
        "POST /api/v1/budgets": async (req) => {
          sent.push(await req.json());
          return json(201, { ...foodBudget, category_id: fuel.id });
        },
      }),
    });
    await fill("Fuel", "40000");
    await userEvent.click(
      screen.getByRole("checkbox", { name: catalogEn["budget.rollover"] }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["budget.create"] }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        `/planning/budgets/${foodBudget.id}`,
      );
    });
    expect(sent).toEqual([
      {
        category_id: fuel.id,
        amount: money(40000),
        effective_from: "2026-10",
        rollover: true,
      },
    ]);
  });

  it("opens the existing budget when the category has one (budget_exists)", async () => {
    const { router } = await renderApp("/planning/budgets/new", {
      fetch: budgetApi({
        "POST /api/v1/budgets": () => problem(409, "budget_exists"),
      }),
    });
    await fill("Food", "100000");
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["budget.create"] }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(
        `/planning/budgets/${foodBudget.id}`,
      );
    });
  });
});

describe("Budget form prefill", () => {
  it("starts from the category the month view asked to budget", async () => {
    const sent: unknown[] = [];
    await renderApp(`/planning/budgets/new?category=${fuel.id}`, {
      fetch: budgetApi({
        "POST /api/v1/budgets": async (req) => {
          sent.push(await req.json());
          return json(201, foodBudget);
        },
      }),
    });
    await userEvent.type(
      await screen.findByRole("textbox", { name: catalogEn["budget.amount"] }),
      "40000",
    );
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["budget.create"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        {
          category_id: fuel.id,
          amount: money(40000),
          effective_from: "2026-10",
          rollover: false,
        },
      ]);
    });
  });
});

describe("Budget page", () => {
  const page = `/planning/budgets/${foodBudget.id}?month=2026-11`;

  it("shows the figures of the month the page reads", async () => {
    await renderApp(page, { fetch: budgetApi() });
    const figures = await screen.findByRole("region", {
      name: catalogEn["budget.monthFigures"],
    });
    for (const amount of ["R$1,800.00", "R$300.00", "R$2,300.00", "−R$200.00"])
      expect(await within(figures).findByText(amount)).toBeInTheDocument();
  });

  it("lists the amounts by month", async () => {
    await renderApp(page, { fetch: budgetApi() });
    const table = await screen.findByRole("table", {
      name: catalogEn["budget.amounts"],
    });
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows.map((row) => row.textContent)).toEqual([
      `${formatMonthTitle("2026-10", "en")}R$1,800.00`,
      `${formatMonthTitle("2026-12", "en")}R$2,000.00`,
    ]);
  });

  it("adds an amount from the month after the latest one", async () => {
    const sent: unknown[] = [];
    await renderApp(page, {
      fetch: budgetApi({
        [`POST /api/v1/budgets/${foodBudget.id}/amounts`]: async (req) => {
          sent.push(await req.json());
          return json(201, foodBudget);
        },
      }),
    });
    await userEvent.click(
      await screen.findByRole("button", {
        name: catalogEn["budget.addAmount"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(
      within(dialog).getByRole("textbox", {
        name: catalogEn["budget.amount"],
      }),
      "210000",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["budget.save"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        { effective_from: "2027-01", amount: money(210000) },
      ]);
    });
  });

  it("charts planned against spent from the first month up to the chosen one", async () => {
    const months: string[] = [];
    await renderApp(page, {
      fetch: budgetApi({
        [`GET /api/v1/budgets/${foodBudget.id}/progress`]: (req) => {
          const month = new URL(req.url).searchParams.get("month") ?? "";
          months.push(month);
          return json(200, progressByBudget[foodBudget.id]?.[month]);
        },
      }),
    });
    await screen.findByText(catalogEn["budget.chart"]);
    await waitFor(() => {
      expect([...new Set(months)].sort()).toEqual(["2026-10", "2026-11"]);
    });
  });

  it("links to the transactions of the category in the month", async () => {
    await renderApp(page, { fetch: budgetApi() });
    const link = await screen.findByRole("link", {
      name: catalogEn["budget.transactions"].replace(
        "{month}",
        formatMonthTitle("2026-11", "en"),
      ),
    });
    expect(link).toHaveAttribute(
      "href",
      `/transactions?account_id=${food.id}&from=2026-11-01&to=2026-11-30`,
    );
  });

  it("deletes the budget from its page and returns to the month (S144)", async () => {
    const deleted: string[] = [];
    const { router } = await renderApp(page, {
      fetch: budgetApi({
        [`DELETE /api/v1/budgets/${foodBudget.id}`]: () => {
          deleted.push(foodBudget.id);
          return new Response(null, { status: 204 });
        },
      }),
    });
    await userEvent.click(
      await screen.findByRole("button", {
        name: catalogEn["budget.more"],
      }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: catalogEn["budget.delete"] }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["budget.delete"] }),
    );
    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/planning");
    });
    expect(deleted).toEqual([foodBudget.id]);
    expect(router.state.location.search).toEqual({
      tab: "budgets",
      month: "2026-11",
    });
  });
});
