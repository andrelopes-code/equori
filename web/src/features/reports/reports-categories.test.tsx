import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json } from "@/testing/fake-api";
import { hideAmounts } from "@/testing/privacy";
import { renderApp } from "@/testing/render-app";
import { categoryReportRoutes, foodID, healthID } from "@/testing/report-api";

const rowTexts = (table: HTMLElement) =>
  within(table)
    .getAllByRole("row")
    .map((row) =>
      [...row.querySelectorAll("th, td")].map((c) => c.textContent).join("|"),
    );

const categoriesTable = () =>
  screen.findByRole("table", { name: catalogEn["report.categories.title"] });

async function choosePreset(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
) {
  const group = screen.getByRole("group", {
    name: catalogEn["transactions.filter.period"],
  });
  const [, trigger] = within(group).getAllByRole("button");
  if (trigger === undefined) throw new Error("period trigger not found");
  await user.click(trigger);
  await user.click(await screen.findByRole("button", { name: label }));
}

const none = catalogEn["report.none"];

function api(overrides: Record<string, (req: Request) => Response> = {}) {
  const queries: URLSearchParams[] = [];
  const routes = categoryReportRoutes();
  const fetch = fakeApi({
    ...routes,
    "GET /api/v1/reports/categories": (req) => {
      queries.push(new URL(req.url).searchParams);
      return routes["GET /api/v1/reports/categories"](req);
    },
    ...overrides,
  });
  return { fetch, queries };
}

describe("Reports categories", () => {
  afterEach(() => {
    localStorage.removeItem("equori.privacy");
  });

  it("totals each top-level category with its subtree and itself, for the current month", async () => {
    const { fetch, queries } = api();
    await renderApp("/reports?tab=categories", { fetch });
    const table = await categoriesTable();
    await within(table).findByText("Food");
    expect(rowTexts(table)).toEqual([
      "Category|Total|Direct|Records",
      "Food|R$90.00|R$10.00|Transactions",
      "Transport|R$40.00|R$0.00|Transactions",
      "Health|R$25.00|R$25.00|Transactions",
      "Total|R$155.00||",
    ]);
    expect(queries).toHaveLength(1);
    expect(Object.fromEntries(queries[0] ?? [])).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
      class: "expense",
    });
  });

  it("goes down into a category and back by the breadcrumb", async () => {
    const { fetch } = api();
    const { router } = await renderApp("/reports?tab=categories", { fetch });
    const user = userEvent.setup();
    const table = await categoriesTable();
    await user.click(await within(table).findByRole("link", { name: "Food" }));
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ parent: foodID });
    });
    const children = await categoriesTable();
    await within(children).findByText("Market");
    expect(rowTexts(children)).toEqual([
      "Category|Total|Direct|Records",
      "Market|R$50.00|R$50.00|Transactions",
      "Diner|R$30.00|R$30.00|Transactions",
      "Food (direct)|R$10.00|R$10.00|",
      "Total|R$90.00||",
    ]);
    const trail = screen.getByRole("navigation", {
      name: catalogEn["report.categories.trail"],
    });
    expect(within(trail).getByText("Food")).toHaveAttribute(
      "aria-current",
      "page",
    );
    await user.click(
      within(trail).getByRole("link", {
        name: catalogEn["report.categories.all"],
      }),
    );
    await waitFor(() => {
      expect(router.state.location.search).not.toHaveProperty("parent");
    });
    await within(await categoriesTable()).findByText("Transport");
  });

  it("links each category to its transactions in the period", async () => {
    const { fetch } = api();
    await renderApp("/reports?tab=categories&from=2026-09-01&to=2026-09-30", {
      fetch,
    });
    const table = await categoriesTable();
    const links = await within(table).findAllByRole("link", {
      name: catalogEn["report.categories.transactions"],
    });
    expect(links[0]?.getAttribute("href")).toBe(
      `/transactions?account_id=${foodID}&from=2026-09-01&to=2026-09-30`,
    );
  });

  it("blocks a period of more than 366 days and one that ends before it starts", async () => {
    const long = api();
    const { unmount } = await renderApp(
      "/reports?tab=categories&from=2025-01-01&to=2026-10-31",
      { fetch: long.fetch },
    );
    expect(
      await screen.findByText(catalogEn["report.period.tooLong"]),
    ).toBeInTheDocument();
    unmount();
    const reversed = api();
    await renderApp("/reports?tab=categories&from=2026-10-31&to=2026-10-01", {
      fetch: reversed.fetch,
    });
    expect(
      await screen.findByText(catalogEn["report.period.reversed"]),
    ).toBeInTheDocument();
    expect(long.queries).toEqual([]);
    expect(reversed.queries).toEqual([]);
  });

  it("sets the period against the one before, with the difference and the percent", async () => {
    const { fetch, queries } = api();
    await renderApp("/reports?tab=categories&compare=true", { fetch });
    const table = await categoriesTable();
    await within(table).findByText("Food");
    expect(rowTexts(table)).toEqual([
      "Category|Total|Direct|Before|Difference|Difference %|Records",
      "Food|R$90.00|R$10.00|R$60.00|+R$30.00|+50.00%|Transactions",
      "Transport|R$40.00|R$0.00|R$50.00|−R$10.00|-20.00%|Transactions",
      `Health|R$25.00|R$25.00|R$0.00|+R$25.00|${none}|Transactions`,
      "Total|R$155.00||R$110.00|+R$45.00|+40.91%|",
    ]);
    expect(queries.map((q) => q.get("from")).sort()).toEqual([
      "2026-09-01",
      "2026-10-01",
    ]);
  });

  it("reads income from the address", async () => {
    const { fetch, queries } = api();
    await renderApp("/reports?tab=categories&class=income", { fetch });
    const table = await categoriesTable();
    await within(table).findByText("Salary");
    expect(queries[0]?.get("class")).toBe("income");
    expect(rowTexts(table)[1]).toBe(
      "Salary|R$3,000.00|R$3,000.00|Transactions",
    );
  });

  it("writes the class, the period kind and the comparison to the address", async () => {
    const { fetch } = api();
    const { router } = await renderApp("/reports?tab=categories", { fetch });
    const user = userEvent.setup();
    await categoriesTable();
    await user.click(
      screen.getByRole("radio", { name: catalogEn["report.class.income"] }),
    );
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ class: "income" });
    });
    await choosePreset(user, catalogEn["report.period.thisQuarter"]);
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({
        from: "2026-10-01",
        to: "2026-12-31",
      });
    });
    await choosePreset(user, catalogEn["transactions.period.thisYear"]);
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({
        from: "2026-01-01",
        to: "2026-12-31",
      });
    });
    await user.click(
      screen.getByRole("switch", { name: catalogEn["report.compare"] }),
    );
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ compare: true });
    });
  });

  it("masks the amounts and keeps the percentages in privacy mode", async () => {
    hideAmounts();
    const { fetch } = api();
    await renderApp("/reports?tab=categories&compare=true", { fetch });
    const table = await categoriesTable();
    await within(table).findByText("Food");
    const text = rowTexts(table).join("\n");
    expect(text).toContain("+50.00%");
    expect(text).not.toContain("90.00");
    expect(text).not.toContain("155.00");
  });

  it("reads in English, region GB and base currency EUR, with nothing Brazilian", async () => {
    const { fetch } = api({
      "GET /api/v1/me": () =>
        json(200, {
          id: 1,
          email: "a@b.c",
          role: "admin",
          language: "en",
          region: "GB",
        }),
      "GET /api/v1/settings": () => json(200, { base_currency: "EUR" }),
      "GET /api/v1/instruments": () =>
        json(200, {
          items: [{ code: "EUR", type: "currency", scale: 2, name: "Euro" }],
        }),
      "GET /api/v1/reports/categories": () =>
        json(200, {
          items: [
            {
              account_id: healthID,
              total: { amount: 2500, currency: "EUR" },
              subtree_total: { amount: 2500, currency: "EUR" },
            },
          ],
        }),
    });
    await renderApp("/reports?tab=categories", { fetch });
    const table = await categoriesTable();
    await within(table).findAllByText("€25.00");
    const text = document.body.textContent;
    expect(text).not.toContain("R$");
    expect(text).not.toContain("BRL");
    expect(text).not.toMatch(/Categoria|Despesa|Patrimônio/);
  });
});
