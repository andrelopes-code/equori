import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { json } from "@/testing/fake-api";
import { portfolioApi } from "@/testing/portfolio-api";
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

  it("asks for the positions at the date of the address, in the base currency", async () => {
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
        ["2026-09-30", null],
      ]);
    });
    expect(
      await screen.findByText(
        catalogEn["portfolio.positions.baseOnly"].replace("{currency}", "BRL"),
      ),
    ).toBeInTheDocument();
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
});
