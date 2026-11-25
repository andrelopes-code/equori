import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { json, problem } from "@/testing/fake-api";
import { accounts, brl, brokerID, cashID } from "@/testing/investment-api";
import {
  instruments,
  portfolioApi,
  positions,
  xpInstitutionID,
} from "@/testing/portfolio-api";
import { hideAmounts } from "@/testing/privacy";
import { renderApp } from "@/testing/render-app";

const gridRows = (grid: HTMLElement) =>
  within(grid)
    .getAllByRole("row")
    .map((row) =>
      [
        ...row.querySelectorAll(
          '[role="rowheader"], [role="gridcell"], [role="columnheader"]',
        ),
      ]
        .map((cell) => cell.textContent)
        .join("|"),
    );

const tableRows = (table: HTMLElement) =>
  within(table)
    .getAllByRole("row")
    .map((row) =>
      [...row.querySelectorAll("th, td")].map((c) => c.textContent).join("|"),
    );

const where = () =>
  screen.findByRole("table", { name: catalogEn["holdings.where"] });

const list = () =>
  screen.findByRole("grid", { name: catalogEn["holdings.list"] });

const pageHeader = () =>
  document.querySelector<HTMLElement>("[data-ui='page-header']") ??
  document.body;

const region = (inside: HTMLElement) =>
  inside.closest<HTMLElement>("[data-ui='section']") ?? document.body;

describe("Portfolio positions page", () => {
  afterEach(() => {
    localStorage.removeItem("equori.locale");
    localStorage.removeItem("equori.privacy");
    localStorage.removeItem("equori.portfolio.columns");
  });

  // PT1: the route opens under the area header with the tab of its page.
  it("PT1: opens the positions route with the heading, the selected tab and the grid", async () => {
    await renderApp("/portfolio/positions", { fetch: portfolioApi() });

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: catalogEn["nav.portfolio"],
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: catalogEn["portfolio.tabs.positions"] }),
    ).toHaveAttribute("aria-selected", "true");
    expect(await list()).toBeInTheDocument();
  });

  it("PC6: a cash balance below zero is listed with no share", async () => {
    const fetch = portfolioApi({
      [`GET /api/v1/accounts/${cashID}/balance`]: () =>
        json(200, { balance: brl(-5000), value: brl(-5000) }),
    });
    await renderApp("/portfolio/positions", { fetch });
    const grid = await list();

    await waitFor(() => {
      expect(gridRows(grid)).toContain("XP cash||−R$50.00|||");
    });
  });

  it("PC5: groups the positions list by the address", async () => {
    await renderApp("/portfolio/positions?by=currency", {
      fetch: portfolioApi(),
    });

    await within(await list()).findByText(/^BRL · /);
  });

  it("PC7: lists name, value, gain and share under groups, with a total", async () => {
    await renderApp("/portfolio/positions", { fetch: portfolioApi() });
    const grid = await list();

    await within(grid).findAllByRole("link", { name: "MXRF11" });
    expect(gridRows(grid)).toEqual([
      [
        catalogEn["positions.instrument"],
        catalogEn["holdings.col.trend"],
        catalogEn["positions.marketValue"],
        catalogEn["positions.result"],
        catalogEn["holdings.total"],
        catalogEn["portfolio.share"],
      ].join("|"),
      `${catalogEn["instruments.type.cash"]} · 1|R$400.00|||73.93%`,
      "XP cash||R$400.00|||73.93%",
      "REITs · 2|R$105.00|+R$5.00|+R$5.00|19.40%",
      "MXRF11||R$105.00|+R$5.00+5.00%|+R$5.00|19.40%",
      `MXRF11||${catalogEn["positions.noPrice"]}|||`,
      "Stocks · 2|R$36.00|+R$5.00|+R$5.00|6.67%",
      "PETR4||R$20.00|+R$5.00+33.33%|+R$5.00|3.69%",
      "PETR4||R$16.00|||2.98%",
      "||R$541.00|+R$10.00|+R$10.00|100.00%",
    ]);
  });

  // S526: the value net of tax of a position that has one.
  it("S526: adds the estimated net column when a position has it", async () => {
    const withNet = positions.map((p, i) =>
      i === 0
        ? { ...p, estimated_net: { amount: 1080000, currency: "BRL" } }
        : p,
    );
    await renderApp("/portfolio/positions", {
      fetch: portfolioApi({
        "GET /api/v1/positions": () =>
          json(200, { items: withNet, quote_warnings: [] }),
      }),
    });
    const grid = await list();

    await within(grid).findAllByRole("link", { name: "MXRF11" });
    expect(
      within(grid).getByRole("columnheader", {
        name: catalogEn["portfolio.estimatedNet"],
      }),
    ).toBeInTheDocument();
    expect(within(grid).getByText("R$10,800.00")).toBeInTheDocument();
  });

  it("S526: draws no estimated net column when no position has it", async () => {
    await renderApp("/portfolio/positions", { fetch: portfolioApi() });
    const grid = await list();

    await within(grid).findAllByRole("link", { name: "MXRF11" });
    expect(
      within(grid).queryByRole("columnheader", {
        name: catalogEn["portfolio.estimatedNet"],
      }),
    ).toBeNull();
  });

  it("PC7: draws the price of each priced position over the last 3 months", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/positions": () =>
        json(200, {
          items: [
            {
              account_id: cashID,
              instrument: "MXRF11",
              quantity: { amount: 10, currency: "MXRF11" },
              cost_basis: brl(1000),
              average_cost: "10.0000",
              market_value: brl(1200),
              prices: [
                {
                  instrument: "MXRF11",
                  quote_instrument: "BRL",
                  date: "2026-10-03",
                  value: "120",
                  source: "manual",
                },
              ],
            },
          ],
          quote_warnings: [],
        }),
      "GET /api/v1/prices": () =>
        json(200, {
          items: ["100", "110", "120"].map((value, i) => ({
            instrument: "MXRF11",
            quote_instrument: "BRL",
            date: `2026-10-0${String(i + 1)}`,
            value,
            source: "manual",
          })),
        }),
    });
    await renderApp("/portfolio/positions", { fetch });
    const grid = await list();

    expect(
      (
        await within(grid).findAllByRole("img", {
          name: /^MXRF11, price over the last 3 months/,
        })
      ).length,
    ).toBeGreaterThan(0);
  });

  it("PC7: says the reason of an empty gain when cost and value differ in currency", async () => {
    await renderApp("/portfolio/positions", { fetch: portfolioApi() });
    await list();
    expect(
      await screen.findAllByLabelText(catalogEn["portfolio.resultMixed"]),
    ).toHaveLength(1);
  });

  it("PC7: names a price only when it is old, and always in the price date column", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/positions": () =>
        json(200, {
          items: [
            {
              account_id: cashID,
              instrument: "PETR4",
              quantity: { amount: 5, currency: "PETR4" },
              cost_basis: brl(1500),
              average_cost: "3.0000",
              market_value: brl(2000),
              prices: [{ date: "2026-08-01", value: "4" }],
            },
          ],
        }),
    });
    await renderApp("/portfolio/positions?date=2026-09-30", { fetch });
    const grid = await list();

    expect(
      await within(grid).findByText(
        catalogEn["positions.priceOf"].replace("{date}", "08/01/2026"),
      ),
    ).toBeInTheDocument();
  });

  it("PC7: adds the technical columns from the column manager and keeps the choice", async () => {
    await renderApp("/portfolio/positions", { fetch: portfolioApi() });
    const user = userEvent.setup();
    const grid = await list();

    expect(
      within(grid).queryByRole("columnheader", {
        name: catalogEn["positions.quantity"],
      }),
    ).toBeNull();

    await user.click(
      screen.getByRole("button", { name: catalogEn["holdings.columns"] }),
    );
    await user.click(
      await screen.findByRole("checkbox", {
        name: new RegExp(catalogEn["positions.quantity"]),
      }),
    );

    expect(
      await within(await list()).findByRole("columnheader", {
        name: catalogEn["positions.quantity"],
      }),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(localStorage.getItem("equori.portfolio.columns")).toContain(
        "averageCost",
      );
    });
  });

  it("PC8: offers to record a trade and an income, and links the unpriced note", async () => {
    await renderApp("/portfolio/positions", { fetch: portfolioApi() });
    await list();

    expect(
      screen.getByRole("link", { name: catalogEn["holdings.trade"] }),
    ).toHaveAttribute("href", "/transactions/new?kind=trade");
    expect(
      screen.getByRole("link", { name: catalogEn["holdings.income.record"] }),
    ).toHaveAttribute("href", "/transactions/new?kind=investment_income");
    expect(
      screen.getByRole("link", { name: catalogEn["holdings.prices"] }),
    ).toHaveAttribute("href", "/instruments");
  });

  // IE6: the income of a row is recorded on the account of the row.
  it("IE6: a position opens the income form on its account, and cash does not", async () => {
    await renderApp("/portfolio/positions", { fetch: portfolioApi() });
    const grid = await list();
    await within(grid).findAllByRole("link", { name: "MXRF11" });

    const links = within(grid).getAllByRole("link", {
      name: catalogEn["holdings.income.recordOf"].replace("{name}", "MXRF11"),
    });
    const accounts = links.map((link) =>
      new URL(link.getAttribute("href") ?? "", "http://x").searchParams.get(
        "account_id",
      ),
    );

    expect(accounts).toEqual(
      positions
        .filter((p) => p.instrument === "MXRF11")
        .map((p) => p.account_id),
    );
    expect(
      within(grid).queryByRole("link", {
        name: catalogEn["holdings.income.recordOf"].replace(
          "{name}",
          "XP cash",
        ),
      }),
    ).not.toBeInTheDocument();
  });

  it("PP3: the page header holds the trade as its one solid action", async () => {
    await renderApp("/portfolio/positions", { fetch: portfolioApi() });
    const grid = await list();
    const header = pageHeader();

    const trade = await within(header).findByRole("link", {
      name: catalogEn["holdings.trade"],
    });
    expect(trade).toHaveAttribute("href", "/transactions/new?kind=trade");
    expect(trade).toHaveAttribute("data-variant", "solid");
    expect(header.querySelectorAll('[data-variant="solid"]')).toHaveLength(1);
    expect(
      within(region(grid)).queryByRole("link", {
        name: catalogEn["holdings.trade"],
      }),
    ).not.toBeInTheDocument();
  });

  it("PP1: draws the holdings section as a surface", async () => {
    await renderApp("/portfolio/positions", { fetch: portfolioApi() });

    expect(region(await list())).toHaveAttribute("data-ground", "surface");
  });

  it("PP6: runs the holdings grid edge to edge, with no frame of its own", async () => {
    await renderApp("/portfolio/positions", { fetch: portfolioApi() });

    expect((await list()).closest("[data-ui='data-grid']")).toHaveAttribute(
      "data-variant",
      "ruled",
    );
  });

  it("PP5: keeps a long instrument name on one line with its whole text in its title", async () => {
    const name = "Petróleo Brasileiro S.A. Petrobras Preferenciais Nominativas";
    const fetch = portfolioApi({
      "GET /api/v1/instruments": () =>
        json(200, {
          items: instruments.map((i) =>
            i.code === "PETR4" ? { ...i, name } : i,
          ),
        }),
    });
    await renderApp("/portfolio/positions", { fetch });
    const grid = await list();

    const lines = await within(grid).findAllByTitle(name);
    for (const line of lines) {
      expect(line).toHaveAttribute("data-truncate");
      expect(within(line).getByRole("link", { name })).toBeInTheDocument();
    }
  });

  it("PC8: shows the empty state with the first action", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/positions": () => json(200, { items: [] }),
      [`GET /api/v1/accounts/${cashID}/balance`]: () =>
        json(200, { balance: brl(0), value: brl(0) }),
    });
    await renderApp("/portfolio/positions", { fetch });

    expect(
      await screen.findByText(catalogEn["portfolio.empty"]),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: catalogEn["holdings.trade"] }),
    ).toBeInTheDocument();
  });

  it("BC9: offers to create a brokerage when the book has none", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/positions": () => json(200, { items: [] }),
      "GET /api/v1/accounts": () => json(200, { items: [] }),
    });
    await renderApp("/portfolio/positions", { fetch });

    expect(
      await screen.findByRole("link", { name: catalogEn["brokerage.create"] }),
    ).toHaveAttribute("href", "/accounts/new?kind=brokerage");
    expect(
      screen.queryByRole("link", { name: catalogEn["holdings.trade"] }),
    ).not.toBeInTheDocument();
  });

  it("TR5: lists the total result of each position after its gain", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/positions": () =>
        json(200, {
          items: positions.map((p, i) =>
            i === 0 ? { ...p, realized: brl(300), income: brl(150) } : p,
          ),
          quote_warnings: [],
          realized: [brl(300)],
          income: [brl(150)],
        }),
    });
    await renderApp("/portfolio/positions?by=type", { fetch });
    const grid = await list();

    await within(grid).findAllByText("+R$9.50");
    expect(gridRows(grid)).toContain(
      "MXRF11||R$105.00|+R$5.00+5.00%|+R$9.50|19.40%",
    );
  });

  it("PC22: offers the way out when the positions cannot be valued at the date", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/positions": () => problem(422, "price_missing"),
    });
    const { router } = await renderApp(
      "/portfolio/positions?value_in=USD&date=2025-11-07",
      {
        fetch,
      },
    );

    await userEvent.setup().click(
      await screen.findByRole("button", {
        name: catalogEn["holdings.missing.inBase"].replace("{base}", "BRL"),
      }),
    );

    await waitFor(() => {
      expect(router.state.location.search).not.toHaveProperty("value_in");
    });
  });

  it("formats by the active region, with no Brazilian value", async () => {
    localStorage.setItem(
      "equori.locale",
      JSON.stringify({ language: "en", region: "DE" }),
    );
    const eur = (amount: number) => ({ amount, currency: "EUR" });
    const fetch = portfolioApi({
      "GET /api/v1/settings": () => json(200, { base_currency: "EUR" }),
      "GET /api/v1/instruments": () =>
        json(200, {
          items: [
            { code: "EUR", type: "currency", scale: 2, name: "Euro" },
            { code: "SAP", type: "stock", scale: 0, name: "SAP SE" },
          ],
        }),
      "GET /api/v1/reports/return": () =>
        json(200, {
          annual_bp: 0,
          flows: [],
          opening: eur(0),
          closing: eur(0),
        }),
      [`GET /api/v1/accounts/${cashID}/balance`]: () =>
        json(200, { balance: eur(0), value: eur(0) }),
      "GET /api/v1/positions": () =>
        json(200, {
          items: [
            {
              account_id: "b0000000-0000-4000-8000-000000000003",
              instrument: "SAP",
              quantity: { amount: 3, currency: "SAP" },
              cost_basis: eur(123456),
              average_cost: "411.52",
              market_value: eur(150000),
            },
          ],
        }),
    });
    const { container } = await renderApp("/portfolio/positions", { fetch });
    const grid = await list();

    await within(grid).findByRole("link", { name: "SAP SE" });
    const euro = new Intl.NumberFormat("en-DE", {
      style: "currency",
      currency: "EUR",
    });
    expect(gridRows(grid).join("\n")).toContain(euro.format(1500));
    expect(container.textContent).not.toMatch(/R\$|BRL|\bB3\b|Carteira/);
  });

  it("writes a quantity and an average cost in the reader's format", async () => {
    localStorage.setItem(
      "equori.locale",
      JSON.stringify({ language: "pt", region: "BR" }),
    );
    localStorage.setItem(
      "equori.portfolio.columns",
      JSON.stringify({
        hidden: ["group", "account", "price", "priceDate", "cost"],
      }),
    );
    const fetch = portfolioApi({
      "GET /api/v1/instruments": () =>
        json(200, {
          items: [
            { code: "BRL", type: "currency", scale: 2, name: "Real" },
            { code: "CDB", type: "fund", scale: 2, name: "CDB XP" },
          ],
        }),
      "GET /api/v1/positions": () =>
        json(200, {
          items: [
            {
              account_id: cashID,
              instrument: "CDB",
              quantity: { amount: 123456, currency: "CDB" },
              cost_basis: { amount: 2730007, currency: "BRL" },
              average_cost: "1076.0769",
              market_value: { amount: 3437608, currency: "BRL" },
            },
          ],
        }),
    });
    await renderApp("/portfolio/positions", { fetch });
    const grid = await screen.findByRole("grid", {
      name: catalogPtBR["holdings.list"],
    });
    await within(grid).findByRole("link", { name: "CDB XP" });
    const text = gridRows(grid).join("\n").replaceAll(" ", " ");

    expect(text).toContain("1.234,56");
    expect(text).toContain("R$ 1.076,0769");
  });

  it("masks the amounts and keeps the shares while privacy mode is on", async () => {
    hideAmounts();
    await renderApp("/portfolio/positions", { fetch: portfolioApi() });
    const grid = await list();

    await within(grid).findAllByRole("link", { name: "MXRF11" });
    expect(document.body.textContent).not.toContain("R$541.00");
    expect(gridRows(grid).join("\n")).toContain("19.40%");
    expect(gridRows(grid).join("\n")).not.toContain("R$105.00");
  });

  it("asks for the positions only once the valuation currency is known", async () => {
    const asked: (string | null)[] = [];
    const fetch = portfolioApi({
      "GET /api/v1/positions": (req) => {
        asked.push(new URL(req.url).searchParams.get("value_in"));
        return json(200, { items: positions, quote_warnings: [] });
      },
    });

    await renderApp("/portfolio/positions", { fetch });
    await screen.findByRole("grid", { name: catalogEn["holdings.list"] });

    expect(asked).not.toHaveLength(0);
    expect(asked).not.toContain(null);
  });

  it("PC6: draws the groups of every row, with shares of the same total", async () => {
    await renderApp("/portfolio/positions", { fetch: portfolioApi() });
    const table = await where();

    await within(table).findByText(catalogEn["instruments.type.cash"]);
    expect(tableRows(table).slice(1)).toEqual([
      `${catalogEn["instruments.type.cash"]}||R$400.00|73.93%`,
      "REITs||R$105.00|19.40%",
      "Stocks||R$36.00|6.67%",
      "Total|R$541.00|100.00%",
    ]);
  });

  it("PC6: a cash balance below zero has no share and leaves the base of the others", async () => {
    const fetch = portfolioApi({
      [`GET /api/v1/accounts/${cashID}/balance`]: () =>
        json(200, { balance: brl(-5000), value: brl(-5000) }),
    });
    await renderApp("/portfolio/positions", { fetch });
    const table = await where();

    await within(table).findByText(catalogEn["instruments.type.cash"]);
    expect(tableRows(table).slice(1)).toEqual([
      "REITs||R$105.00|74.46%",
      "Stocks||R$36.00|25.54%",
      `${catalogEn["instruments.type.cash"]}||−R$50.00|—`,
      "Total|R$91.00|100.00%",
    ]);
  });

  it("PC5: one control groups the bars and the list, from the address", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/accounts": () =>
        json(200, {
          items: accounts.map((a) =>
            a.id === brokerID ? { ...a, institution_id: xpInstitutionID } : a,
          ),
        }),
    });
    await renderApp("/portfolio/positions?by=institution", { fetch });
    const table = await where();

    await within(table).findByText("XP");
    expect(document.body.textContent).not.toContain(xpInstitutionID);

    await userEvent
      .setup()
      .click(
        screen.getByRole("radio", { name: catalogEn["portfolio.by.currency"] }),
      );
    await within(await where()).findByText("BRL");
  });

  it("PP6: runs the where table edge to edge, with no frame of its own", async () => {
    await renderApp("/portfolio/positions", { fetch: portfolioApi() });

    expect((await where()).closest("[data-ui='table']")).toHaveAttribute(
      "data-variant",
      "ruled",
    );
  });

  it("PP1: draws the where section as a surface", async () => {
    await renderApp("/portfolio/positions", { fetch: portfolioApi() });

    expect(region(await where())).toHaveAttribute("data-ground", "surface");
  });
});
