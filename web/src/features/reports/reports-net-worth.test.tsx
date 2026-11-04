import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json, problem } from "@/testing/fake-api";
import { hideAmounts } from "@/testing/privacy";
import { renderApp } from "@/testing/render-app";
import { reportApiRoutes } from "@/testing/report-api";

const rowTexts = (table: HTMLElement) =>
  within(table)
    .getAllByRole("row")
    .map((row) =>
      [...row.querySelectorAll("th, td")].map((c) => c.textContent).join("|"),
    );

const netWorthTable = () =>
  screen.findByRole("table", { name: catalogEn["report.netWorth.title"] });

// FakeFetch records only unrouted calls, so a route wrapper records the queries.
function api(overrides: Record<string, (req: Request) => Response> = {}) {
  const queries: URLSearchParams[] = [];
  const routes = reportApiRoutes();
  const fetch = fakeApi({
    ...routes,
    "GET /api/v1/reports/net-worth": (req) => {
      queries.push(new URL(req.url).searchParams);
      return routes["GET /api/v1/reports/net-worth"](req);
    },
    ...overrides,
  });
  return { fetch, queries };
}

describe("Reports net worth", () => {
  afterEach(() => {
    localStorage.removeItem("equori.privacy");
    localStorage.removeItem("equori.locale");
  });

  it("reads one month end per month, today for the current month", async () => {
    const { fetch, queries } = api();
    await renderApp("/reports", { fetch });
    await netWorthTable();
    await waitFor(() => {
      expect(queries).toHaveLength(12);
    });
    const dates = queries.map((q) => q.get("date")).sort();
    expect(dates[0]).toBe("2025-11-30");
    expect(dates[11]).toBe("2026-10-17");
    expect(dates).toContain("2026-09-30");
  });

  it("draws the net worth of each day of the current month", async () => {
    const days: URLSearchParams[] = [];
    const routes = reportApiRoutes();
    const { fetch } = api({
      "GET /api/v1/reports/net-worth/days": (req) => {
        days.push(new URL(req.url).searchParams);
        return routes["GET /api/v1/reports/net-worth/days"](req);
      },
    });

    await renderApp("/reports", { fetch });

    expect(
      await screen.findByRole("group", {
        name: "Net worth by day · October 2026",
      }),
    ).toBeVisible();
    expect(days.at(-1)?.get("from")).toBe("2026-10-01");
    expect(days.at(-1)?.get("to")).toBe("2026-10-17");
  });

  it("picks a past month with the month control and lists its income and expenses, the largest first", async () => {
    const user = userEvent.setup();
    const days: URLSearchParams[] = [];
    const routes = reportApiRoutes();
    const { fetch } = api({
      "GET /api/v1/reports/net-worth/days": (req) => {
        days.push(new URL(req.url).searchParams);
        return routes["GET /api/v1/reports/net-worth/days"](req);
      },
      "GET /api/v1/accounts": () =>
        json(200, {
          items: [
            {
              id: "food",
              name: "Food",
              class: "expense",
              currency: "BRL",
              opened_on: "2026-01-01",
              yield_mode: "none",
            },
          ],
        }),
      "GET /api/v1/transactions": (req) =>
        json(200, {
          items:
            new URL(req.url).searchParams.get("from") === "2026-09-01"
              ? [expense("t1", "2026-09-12", "Market", 4500)]
              : [],
        }),
    });

    await renderApp("/reports", { fetch });

    const card = await screen.findByRole("group", {
      name: "Net worth by day · October 2026",
    });
    await user.click(
      within(card.closest("[data-ui='card']") ?? document.body).getByRole(
        "button",
        { name: "Previous month" },
      ),
    );

    const table = await screen.findByRole("table", {
      name: "Income and expenses of the month",
    });
    await within(table).findByText("Market");
    expect(rowTexts(table)).toContain("Sep 12|MarketFood|\u2212R$45.00");
    // The expense row, the expenses total and the result of the month.
    expect(screen.getAllByText("\u2212R$45.00")).toHaveLength(3);
    expect(days.at(-1)?.get("from")).toBe("2026-09-01");
    expect(days.at(-1)?.get("to")).toBe("2026-09-30");
  });

  it("reads 24 months at most", async () => {
    const { fetch, queries } = api();
    await renderApp("/reports?months=24", { fetch });
    await netWorthTable();
    await waitFor(() => {
      expect(queries).toHaveLength(24);
    });
    expect(queries.map((q) => q.get("date")).sort()[0]).toBe("2024-11-30");
  });

  it("falls back to 12 months for a value outside 6, 12 and 24", async () => {
    const { fetch, queries } = api();
    await renderApp("/reports?months=60", { fetch });
    await netWorthTable();
    await waitFor(() => {
      expect(queries).toHaveLength(12);
    });
  });

  it("lists assets, liabilities, net and the change against the month before (S129)", async () => {
    const { fetch } = api();
    await renderApp("/reports?months=6", { fetch });
    const table = await netWorthTable();
    await within(table).findByText("R$1,005.00");
    expect(rowTexts(table)).toEqual([
      "Month|You own|You owe|Net|Change|Change %",
      "Oct 2026|R$2,205.00|R$1,200.00|R$1,005.00|+R$150.00|+17.54%",
      "Sep 2026|R$2,055.00|R$1,200.00|R$855.00|+R$55.00|+6.88%",
      "Aug 2026|R$2,000.00|R$1,200.00|R$800.00|R$0.00|0.00%",
      "Jul 2026|R$2,000.00|R$1,200.00|R$800.00|R$0.00|0.00%",
      "Jun 2026|R$2,000.00|R$1,200.00|R$800.00|R$0.00|0.00%",
      `May 2026|R$2,000.00|R$1,200.00|R$800.00|${catalogEn["report.none"]}|${catalogEn["report.none"]}`,
    ]);
  });

  it("keeps the other months when one month cannot be valued", async () => {
    const { fetch } = api({
      "GET /api/v1/reports/net-worth": (req) => {
        const date = new URL(req.url).searchParams.get("date") ?? "";
        return date === "2026-08-31"
          ? problem(422, "price_missing")
          : reportApiRoutes()["GET /api/v1/reports/net-worth"](req);
      },
    });
    await renderApp("/reports?months=6", { fetch });
    const table = await netWorthTable();
    await within(table).findByText("R$1,005.00");
    const none = catalogEn["report.none"];
    const rows = rowTexts(table);
    expect(rows[3]).toBe(`Aug 2026|${none}|${none}|${none}|${none}|${none}`);
    expect(rows[2]).toBe(
      `Sep 2026|R$2,055.00|R$1,200.00|R$855.00|${none}|${none}`,
    );
    expect(rows[1]).toContain("R$1,005.00");
  });

  it("sends value_in, the base currency by default and the chosen one from the address", async () => {
    const first = api();
    const { unmount } = await renderApp("/reports", { fetch: first.fetch });
    await netWorthTable();
    await waitFor(() => {
      expect(first.queries).toHaveLength(12);
    });
    expect(new Set(first.queries.map((q) => q.get("value_in")))).toEqual(
      new Set(["BRL"]),
    );
    unmount();
    const second = api();
    await renderApp("/reports?value_in=USD", { fetch: second.fetch });
    await netWorthTable();
    await waitFor(() => {
      expect(second.queries).toHaveLength(12);
    });
    expect(new Set(second.queries.map((q) => q.get("value_in")))).toEqual(
      new Set(["USD"]),
    );
  });

  it("changes the span from the selector and writes it to the address", async () => {
    const { fetch, queries } = api();
    const { router } = await renderApp("/reports", { fetch });
    await netWorthTable();
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("radio", {
        name: catalogEn["report.netWorth.months"].replace("{count}", "24"),
      }),
    );
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ months: 24 });
    });
    await waitFor(() => {
      expect(new Set(queries.map((q) => q.get("date"))).size).toBe(24);
    });
  });

  it("opens on the net worth tab and routes the others through the address", async () => {
    const { fetch } = api();
    const { router } = await renderApp("/reports", { fetch });
    await netWorthTable();
    const tabs = screen.getByRole("tablist", {
      name: catalogEn["report.tabs"],
    });
    expect(
      within(tabs)
        .getAllByRole("tab")
        .map((t) => t.textContent),
    ).toEqual([
      catalogEn["report.tab.netWorth"],
      catalogEn["report.tab.categories"],
      catalogEn["report.tab.flows"],
      catalogEn["report.tab.indicators"],
    ]);
    await userEvent
      .setup()
      .click(
        within(tabs).getByRole("tab", { name: catalogEn["report.tab.flows"] }),
      );
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ tab: "flows" });
    });
  });

  it("masks the amounts and keeps the percentages in privacy mode", async () => {
    hideAmounts();
    const { fetch } = api();
    await renderApp("/reports?months=6", { fetch });
    const table = await netWorthTable();
    await within(table).findByText("Oct 2026");
    const text = rowTexts(table).join("\n");
    expect(text).toContain("+17.54%");
    expect(text).not.toContain("1,005.00");
    expect(text).not.toContain("150.00");
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
      "GET /api/v1/reports/net-worth": () =>
        json(200, {
          assets: { amount: 123456, currency: "EUR" },
          liabilities: { amount: 6000, currency: "EUR" },
          net: { amount: 117456, currency: "EUR" },
        }),
    });
    await renderApp("/reports?months=6", { fetch });
    const table = await netWorthTable();
    await within(table).findAllByText("€1,234.56");
    const text = document.body.textContent;
    expect(text).toContain("€1,174.56");
    expect(text).not.toContain("R$");
    expect(text).not.toContain("BRL");
    expect(text).not.toMatch(/Patrimônio|Ativos/);
  });
});

function expense(
  id: string,
  date: string,
  description: string,
  amount: number,
) {
  return {
    id,
    date,
    description,
    balancing_currency: "BRL",
    origin: "manual",
    version: 1,
    tags: [],
    links: [],
    postings: [
      { account_id: "food", amount: { amount, currency: "BRL" } },
      { account_id: "card", amount: { amount: -amount, currency: "BRL" } },
    ],
  };
}
