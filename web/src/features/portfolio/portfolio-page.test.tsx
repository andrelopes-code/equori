import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { json } from "@/testing/fake-api";
import { petrID, portfolioApi } from "@/testing/portfolio-api";
import { hideAmounts, expectNoAmounts } from "@/testing/privacy";
import { renderApp } from "@/testing/render-app";

const rowTexts = (table: HTMLElement) =>
  within(table)
    .getAllByRole("row")
    .map((row) =>
      [
        ...row.querySelectorAll(
          '[role="rowheader"], [role="cell"], [role="columnheader"], th, td',
        ),
      ]
        .map((cell) => cell.textContent)
        .join("|"),
    );

const positionsTable = () =>
  screen.findByRole("table", { name: catalogEn["portfolio.positions.title"] });

describe("Portfolio positions", () => {
  afterEach(() => {
    localStorage.removeItem("equori.locale");
    localStorage.removeItem("equori.privacy");
  });

  it("groups the positions by account with cost, value, result and share", async () => {
    await renderApp("/portfolio", { fetch: portfolioApi() });
    const table = await positionsTable();
    await within(table).findAllByText("XP / XP MXRF11");
    expect(rowTexts(table)).toEqual([
      [
        "Security",
        "Account",
        "Quantity",
        "Average cost",
        "Cost",
        "Market value",
        "Unrealized result",
        "Share",
      ].join("|"),
      "XP",
      "PETR4|XP|1|3.0000|$3.00|R$16.00||11.36%",
      "XP / XP cash",
      `MXRF11|XP / XP cash|2|5.0000|R$10.00|${catalogEn["positions.noPrice"]}||`,
      "XP / XP MXRF11",
      "MXRF11|XP / XP MXRF11|10|10.0000|R$100.00|R$105.00|+R$5.00|74.46%",
      "XP / XP PETR4",
      "PETR4|XP / XP PETR4|5|3.0000|R$15.00|R$20.00|+R$5.00|14.18%",
      `${catalogEn["portfolio.total"]}|R$141.00||100.00%`,
    ]);
  });

  it("leaves the result empty and says why when cost and value differ in currency", async () => {
    await renderApp("/portfolio", { fetch: portfolioApi() });
    await positionsTable();
    expect(
      await screen.findAllByLabelText(catalogEn["portfolio.resultMixed"]),
    ).toHaveLength(1);
  });

  it("counts the positions without a price above the table", async () => {
    await renderApp("/portfolio", { fetch: portfolioApi() });
    expect(
      await screen.findByText(
        "Positions without a price, left out of the total and of the shares: 1",
      ),
    ).toBeInTheDocument();
  });

  it("groups by security on request", async () => {
    await renderApp("/portfolio", { fetch: portfolioApi() });
    const user = userEvent.setup();
    const table = await positionsTable();
    await within(table).findAllByText("XP / XP MXRF11");
    await user.click(
      screen.getByRole("radio", {
        name: catalogEn["portfolio.group.instrument"],
      }),
    );
    await waitFor(() => {
      expect(rowTexts(table).filter((row) => !row.includes("|"))).toEqual([
        "MXRF11",
        "PETR4",
      ]);
    });
  });

  it("links each security to its page and each account to its record", async () => {
    await renderApp("/portfolio", { fetch: portfolioApi() });
    const table = await positionsTable();
    const links = await within(table).findAllByRole("link", {
      name: "MXRF11",
    });
    expect(links[0]).toHaveAttribute("href", "/instruments/MXRF11");
    expect(
      within(table).getAllByRole("link", { name: "XP / XP PETR4" })[0],
    ).toHaveAttribute("href", expect.stringContaining("/accounts/"));
  });

  it("asks for the positions at the date of the address, valued in the base currency", async () => {
    const asked: URLSearchParams[] = [];
    const fetch = portfolioApi({
      "GET /api/v1/positions": (req) => {
        asked.push(new URL(req.url).searchParams);
        return json(200, { items: [] });
      },
    });
    await renderApp("/portfolio?date=2026-09-30", { fetch });
    await waitFor(() => {
      expect(asked.map((q) => [q.get("date"), q.get("value_in")])).toEqual([
        ["2026-09-30", "BRL"],
      ]);
    });
  });

  it("values the positions in the currency chosen in the address, with a base currency of EUR", async () => {
    localStorage.setItem(
      "equori.locale",
      JSON.stringify({ language: "en", region: "DE" }),
    );
    const asked: (string | null)[] = [];
    const fetch = portfolioApi({
      "GET /api/v1/settings": () => json(200, { base_currency: "EUR" }),
      "GET /api/v1/positions": (req) => {
        asked.push(new URL(req.url).searchParams.get("value_in"));
        return json(200, {
          items: [
            {
              account_id: "b0000000-0000-4000-8000-000000000003",
              instrument: "PETR4",
              quantity: { amount: 3, currency: "PETR4" },
              cost_basis: { amount: 1000, currency: "EUR" },
              average_cost: "3.3333",
              market_value: { amount: 2100, currency: "USD" },
            },
          ],
        });
      },
    });
    await renderApp("/portfolio?value_in=USD", { fetch });
    const table = await positionsTable();
    const usd = new Intl.NumberFormat("en-DE", {
      style: "currency",
      currency: "USD",
    });
    await within(table).findAllByText(usd.format(21));
    expect(asked).toEqual(["USD"]);
    expect(rowTexts(table).at(-1)).toContain(usd.format(21));
  });

  it("shows the empty state when no account holds a position", async () => {
    const fetch = portfolioApi({
      "GET /api/v1/positions": () => json(200, { items: [] }),
    });
    await renderApp("/portfolio", { fetch });
    expect(
      await screen.findByText(catalogEn["portfolio.empty"]),
    ).toBeInTheDocument();
  });

  it("formats numbers and the share by the active region, with no Brazilian value", async () => {
    localStorage.setItem(
      "equori.locale",
      JSON.stringify({ language: "en", region: "DE" }),
    );
    const fetch = portfolioApi({
      "GET /api/v1/settings": () => json(200, { base_currency: "EUR" }),
      "GET /api/v1/reports/allocation": () =>
        json(200, { total: { amount: 0, currency: "EUR" }, groups: [] }),
      "GET /api/v1/reports/return": () =>
        json(200, {
          annual_bp: 0,
          flows: [],
          opening: { amount: 0, currency: "EUR" },
          closing: { amount: 0, currency: "EUR" },
        }),
      "GET /api/v1/instruments": () =>
        json(200, {
          items: [
            { code: "EUR", type: "currency", scale: 2, name: "Euro" },
            { code: "SAP", type: "stock", scale: 0, name: "SAP" },
          ],
        }),
      "GET /api/v1/positions": () =>
        json(200, {
          items: [
            {
              account_id: "b0000000-0000-4000-8000-000000000003",
              instrument: "SAP",
              quantity: { amount: 3, currency: "SAP" },
              cost_basis: { amount: 123456, currency: "EUR" },
              average_cost: "411.52",
              market_value: { amount: 150000, currency: "EUR" },
            },
          ],
        }),
    });
    const { container } = await renderApp("/portfolio", { fetch });
    const table = await positionsTable();
    await within(table).findByText("SAP", { selector: "a" });
    const text = rowTexts(table).join("\n");
    const percent = new Intl.NumberFormat("en-DE", {
      style: "percent",
      minimumFractionDigits: 2,
    });
    const euro = new Intl.NumberFormat("en-DE", {
      style: "currency",
      currency: "EUR",
    });
    expect(text).toContain(euro.format(1500));
    expect(text).toContain(percent.format(1));
    expect(container.textContent).not.toMatch(/R\$|BRL|\bB3\b|Carteira/);
  });

  it("masks the amounts and keeps the shares while privacy mode is on", async () => {
    hideAmounts();
    const { container } = await renderApp("/portfolio", {
      fetch: portfolioApi(),
    });
    const table = await positionsTable();
    await within(table).findAllByText("XP / XP MXRF11");
    await waitFor(() => {
      expect(rowTexts(table).some((row) => row.includes("74.46%"))).toBe(true);
    });
    // A share is a percentage, not an amount: the check reads the page without them.
    const amounts = document.createElement("div");
    amounts.innerHTML = container.innerHTML.replace(/[\d.,]+\s?%/g, "");
    expectNoAmounts(amounts, ["R$105.00", "R$141.00", "10.0000"]);
  });

  // The value is as recent as the oldest price it used: PETR4 in USD on 10-23, USD in BRL on 10-22.
  const priced = {
    account_id: petrID,
    instrument: "PETR4",
    quantity: { amount: 5, currency: "PETR4" },
    cost_basis: { amount: 1500, currency: "BRL" },
    market_value: { amount: 2000, currency: "BRL" },
    prices: [
      {
        instrument: "PETR4",
        quote_instrument: "USD",
        date: "2026-10-23",
        value: "0.8",
        source: "manual",
      },
      {
        instrument: "USD",
        quote_instrument: "BRL",
        date: "2026-10-22",
        value: "5",
        source: "bcb_ptax",
      },
    ],
  };
  const pricedApi = () =>
    portfolioApi({
      "GET /api/v1/positions": () => json(200, { items: [priced] }),
    });

  it("dates the market value by the oldest price it used", async () => {
    await renderApp("/portfolio", { fetch: pricedApi() });
    const table = await positionsTable();
    expect(
      await within(table).findByText(
        catalogEn["positions.priceOf"].replace("{date}", "10/22/2026"),
      ),
    ).toBeInTheDocument();
  });

  it("dates the market value on a phone line", async () => {
    await renderApp("/portfolio", { width: 390, fetch: pricedApi() });
    expect(
      await screen.findByText(
        `${catalogEn["positions.marketValue"]}: R$20.00 · ${catalogEn["positions.priceOf"].replace("{date}", "10/22/2026")}`,
      ),
    ).toBeInTheDocument();
  });

  it("writes each phone line as a label and its value", async () => {
    await renderApp("/portfolio", { width: 390, fetch: portfolioApi() });
    expect(
      await screen.findByText(
        `${catalogEn["positions.marketValue"]}: ${catalogEn["positions.noPrice"]}`,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`${catalogEn["positions.marketValue"]}: R$105.00`),
    ).toBeInTheDocument();
  });

  it("moves the date and currency out of the header on a phone", async () => {
    await renderApp("/portfolio", { width: 390, fetch: portfolioApi() });
    const currency = await screen.findByRole("combobox", {
      name: catalogEn["portfolio.valueIn"],
    });
    expect(currency.closest('[data-ui="page-header"]')).toBeNull();
  });
});
