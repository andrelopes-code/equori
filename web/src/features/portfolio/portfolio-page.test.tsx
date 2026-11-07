import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import { json, problem } from "@/testing/fake-api";
import { accounts, brl, brokerID, cashID } from "@/testing/investment-api";
import { portfolioApi, xpInstitutionID } from "@/testing/portfolio-api";
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

const list = () =>
  screen.findByRole("grid", { name: catalogEn["holdings.list"] });

const where = () =>
  screen.findByRole("table", { name: catalogEn["holdings.where"] });

const figure = async (label: string) =>
  (await screen.findByText(label)).closest<HTMLElement>(
    "[data-ui='stat-card']",
  ) ?? document.body;

describe("Portfolio page", () => {
  afterEach(() => {
    localStorage.removeItem("equori.locale");
    localStorage.removeItem("equori.privacy");
    localStorage.removeItem("equori.portfolio.columns");
  });

  it("PC2: states one value, its parts and the unpriced rows", async () => {
    await renderApp("/portfolio", { fetch: portfolioApi() });
    const card = await figure(catalogEn["holdings.value"]);

    await within(card).findByText("R$541.00");
    expect(card.textContent).toContain(
      catalogEn["holdings.value.note"]
        .replace("{positions}", "R$141.00")
        .replace("{cash}", "R$400.00"),
    );
    expect(card.textContent).toContain(
      catalogEn["holdings.value.unpriced"].replace("{count}", "1"),
    );
  });

  it("PC2: measures the gain on the positions with one currency and says what it leaves out", async () => {
    await renderApp("/portfolio", { fetch: portfolioApi() });
    const card = await figure(catalogEn["holdings.gain"]);

    await within(card).findByText("+R$10.00");
    expect(card.textContent).toContain(
      catalogEn["holdings.gain.note"].replace("{cost}", "R$115.00"),
    );
    expect(card.textContent).toContain(
      catalogEn["holdings.gain.mixed"].replace("{count}", "1"),
    );
  });

  it("PC2: states the net income of the year up to the valuation date, with a door", async () => {
    const asked: (string | null)[] = [];
    const fetch = portfolioApi({
      "GET /api/v1/income-events": (req) => {
        asked.push(new URL(req.url).searchParams.get("year"));
        return json(200, {
          from: "2025-01-01",
          to: "2025-12-31",
          items: [
            { date: "2025-02-01", gross: brl(1000), withheld: brl(150) },
            { date: "2025-11-01", gross: brl(9000), withheld: brl(0) },
          ],
        });
      },
    });
    await renderApp("/portfolio?date=2025-06-30", { fetch });
    const card = await figure(
      catalogEn["holdings.income"].replace("{year}", "2025"),
    );

    await within(card).findByText("R$8.50");
    expect(card.textContent).toContain(
      catalogEn["holdings.income.note"].replace("{withheld}", "R$1.50"),
    );
    expect(asked).toEqual(["2025"]);
    expect(
      within(card).getByRole("link", {
        name: catalogEn["holdings.income.open"],
      }),
    ).toHaveAttribute("href", "/portfolio/year?year=2025&tab=income");
  });

  it("PC6: draws the groups of every row, with shares of the same total", async () => {
    await renderApp("/portfolio", { fetch: portfolioApi() });
    const table = await where();

    await within(table).findByText(catalogEn["instruments.type.cash"]);
    expect(tableRows(table).slice(1)).toEqual([
      `${catalogEn["instruments.type.cash"]}||R$400.00|73.93%`,
      "REITs||R$105.00|19.40%",
      "Stocks||R$36.00|6.67%",
      "Total|R$541.00|100.00%",
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
    await renderApp("/portfolio?by=institution", { fetch });
    const table = await where();

    await within(table).findByText("XP");
    expect(document.body.textContent).not.toContain(xpInstitutionID);

    await userEvent
      .setup()
      .click(
        screen.getByRole("radio", { name: catalogEn["portfolio.by.currency"] }),
      );
    await within(await where()).findByText("BRL");
    await within(await list()).findByText(/^BRL · /);
  });

  it("PC7: lists name, value, gain and share under groups, with a total", async () => {
    await renderApp("/portfolio", { fetch: portfolioApi() });
    const grid = await list();

    await within(grid).findAllByRole("link", { name: "MXRF11" });
    expect(gridRows(grid)).toEqual([
      [
        catalogEn["positions.instrument"],
        catalogEn["positions.marketValue"],
        catalogEn["positions.result"],
        catalogEn["portfolio.share"],
      ].join("|"),
      `${catalogEn["instruments.type.cash"]} · 1|R$400.00||73.93%`,
      "XP cash|R$400.00||73.93%",
      "REITs · 2|R$105.00|+R$5.00|19.40%",
      "MXRF11|R$105.00|+R$5.00+5.00%|19.40%",
      `MXRF11|${catalogEn["positions.noPrice"]}||`,
      "Stocks · 2|R$36.00|+R$5.00|6.67%",
      "PETR4|R$20.00|+R$5.00+33.33%|3.69%",
      "PETR4|R$16.00||2.98%",
      "|R$541.00|+R$10.00|100.00%",
    ]);
  });

  it("PC7: says the reason of an empty gain when cost and value differ in currency", async () => {
    await renderApp("/portfolio", { fetch: portfolioApi() });
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
    await renderApp("/portfolio?date=2026-09-30", { fetch });
    const grid = await list();

    expect(
      await within(grid).findByText(/^Price of 08\/01\/2026$/),
    ).toBeInTheDocument();
  });

  it("PC7: adds the technical columns from the column manager and keeps the choice", async () => {
    await renderApp("/portfolio", { fetch: portfolioApi() });
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
    await renderApp("/portfolio", { fetch: portfolioApi() });
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

  it("PC8: shows the empty state with the first action", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/positions": () => json(200, { items: [] }),
      [`GET /api/v1/accounts/${cashID}/balance`]: () =>
        json(200, { balance: brl(0), value: brl(0) }),
    });
    await renderApp("/portfolio", { fetch });

    expect(
      await screen.findByText(catalogEn["portfolio.empty"]),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: catalogEn["holdings.trade"] }),
    ).toBeInTheDocument();
  });

  it("PC4: counts brokerage cash it cannot value as unpriced and keeps the rest", async () => {
    const fetch = portfolioApi({
      [`GET /api/v1/accounts/${cashID}/balance`]: () =>
        problem(422, "price_missing"),
    });
    await renderApp("/portfolio", { fetch });
    const card = await figure(catalogEn["holdings.value"]);

    await within(card).findByText("R$141.00");
    expect(card.textContent).toContain(
      catalogEn["holdings.value.unpriced"].replace("{count}", "2"),
    );
  });

  it("PC4: reads the cash in the valuation currency, not in the account's", async () => {
    const usd = (amount: number) => ({ amount, currency: "USD" });
    const fetch = portfolioApi({
      "GET /api/v1/positions": () =>
        json(200, {
          items: [
            {
              account_id: cashID,
              instrument: "PETR4",
              quantity: { amount: 5, currency: "PETR4" },
              cost_basis: brl(1500),
              market_value: usd(300),
            },
          ],
        }),
      [`GET /api/v1/accounts/${cashID}/balance`]: () =>
        json(200, { balance: brl(40000), value: usd(7000) }),
    });
    await renderApp("/portfolio?value_in=USD", { fetch });
    const card = await figure(catalogEn["holdings.value"]);

    await within(card).findByText("$73.00");
    expect(card.textContent).toContain(
      catalogEn["holdings.value.note"]
        .replace("{positions}", "$3.00")
        .replace("{cash}", "$70.00"),
    );
  });

  it("PC23: says the gain reads in the currency of the cost, with a way there", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/positions": () =>
        json(200, {
          items: [
            {
              account_id: cashID,
              instrument: "PETR4",
              quantity: { amount: 5, currency: "PETR4" },
              cost_basis: brl(1500),
              market_value: { amount: 300, currency: "USD" },
            },
          ],
        }),
    });
    await renderApp("/portfolio?value_in=USD", { fetch });
    const card = await figure(catalogEn["holdings.gain"]);

    expect(
      await within(card).findByText(
        catalogEn["holdings.gain.elsewhere"].replace("{currency}", "BRL"),
      ),
    ).toBeInTheDocument();
    expect(card.textContent).not.toContain("$0.00");
    expect(
      within(card).getByRole("link", {
        name: catalogEn["holdings.missing.inBase"].replace("{base}", "BRL"),
      }),
    ).toHaveAttribute("href", "/portfolio");
  });

  it("PC24: reads the income of the tax year that holds the valuation date", async () => {
    const asked: (string | null)[] = [];
    const fetch = portfolioApi({
      "GET /api/v1/income-events": (req) => {
        const year = new URL(req.url).searchParams.get("year");
        asked.push(year);
        return json(200, {
          from: `${year ?? ""}-04-06`,
          to: `${String(Number(year) + 1)}-04-05`,
          items:
            year === "2025"
              ? [{ date: "2025-12-01", gross: brl(1000), withheld: brl(0) }]
              : [],
        });
      },
    });
    await renderApp("/portfolio?date=2026-02-10", { fetch });
    const card = await figure(
      catalogEn["holdings.income"].replace("{year}", "2025"),
    );

    await within(card).findByText("R$10.00");
    expect(asked).toEqual(["2026", "2025"]);
  });

  it("PC22: offers the way out when the positions cannot be valued at the date", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/positions": () => problem(422, "price_missing"),
    });
    const { router } = await renderApp(
      "/portfolio?value_in=USD&date=2025-11-07",
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

  it("asks at the date of the address and in the chosen currency", async () => {
    const positions: URLSearchParams[] = [];
    const balances: URLSearchParams[] = [];
    const fetch = portfolioApi({
      "GET /api/v1/positions": (req) => {
        positions.push(new URL(req.url).searchParams);
        return json(200, { items: [] });
      },
      [`GET /api/v1/accounts/${cashID}/balance`]: (req) => {
        balances.push(new URL(req.url).searchParams);
        return json(200, {
          balance: brl(0),
          value: { amount: 0, currency: "USD" },
        });
      },
    });
    await renderApp("/portfolio?date=2026-09-30&value_in=USD", { fetch });

    await waitFor(() => {
      expect(positions.map((q) => [q.get("date"), q.get("value_in")])).toEqual([
        ["2026-09-30", "USD"],
      ]);
      expect(balances.map((q) => [q.get("date"), q.get("value_in")])).toEqual([
        ["2026-09-30", "USD"],
      ]);
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
    const { container } = await renderApp("/portfolio", { fetch });
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
            { code: "CDB", type: "fixed_income", scale: 2, name: "CDB XP" },
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
    await renderApp("/portfolio", { fetch });
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
    await renderApp("/portfolio", { fetch: portfolioApi() });
    const grid = await list();

    await within(grid).findAllByRole("link", { name: "MXRF11" });
    expect(document.body.textContent).not.toContain("R$541.00");
    expect(gridRows(grid).join("\n")).toContain("19.40%");
    expect(gridRows(grid).join("\n")).not.toContain("R$105.00");
  });

  it("names the header's currency and date without a visible label", async () => {
    await renderApp("/portfolio?date=2026-09-30", { fetch: portfolioApi() });
    const currency = await screen.findByRole("combobox", {
      name: catalogEn["portfolio.valueIn"],
    });
    const header = currency.closest('[data-ui="page-header"]');
    expect(header).not.toBeNull();
    expect(
      within(header as HTMLElement).getByRole("button", {
        name: /^Valuation date, /,
      }),
    ).toBeVisible();
    expect(header).not.toHaveTextContent(catalogEn["portfolio.valueIn"]);
    expect(header).not.toHaveTextContent(catalogEn["portfolio.date"]);
  });

  it("PC9: links the year with a short word", async () => {
    await renderApp("/portfolio", { fetch: portfolioApi() });

    expect(
      await screen.findByRole("link", { name: catalogEn["holdings.year"] }),
    ).toHaveAttribute("href", "/portfolio/year");
  });
});
