import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { json, problem } from "@/testing/fake-api";
import { hideAmounts, expectNoAmounts } from "@/testing/privacy";
import { renderApp } from "@/testing/render-app";
import { saleID, taxYearApi } from "@/testing/tax-year-api";

const rowTexts = (table: HTMLElement) =>
  within(table)
    .getAllByRole("row")
    .map((row) =>
      [...row.querySelectorAll('[role="cell"], [role="columnheader"], th, td')]
        .map((cell) => cell.textContent)
        .join("|"),
    );

const results = () =>
  screen.findByRole("table", { name: catalogEn["taxYear.realized.title"] });

describe("Tax year of investments", () => {
  afterEach(() => {
    localStorage.removeItem("equori.locale");
    localStorage.removeItem("equori.privacy");
  });

  it("reads the calendar year of the app clock and names its first and last day", async () => {
    const years: string[] = [];
    await renderApp("/portfolio/year", {
      fetch: taxYearApi(years),
      today: "2026-10-24",
    });
    await results();
    expect(years).toEqual(["2026"]);
    expect(
      screen.getByText("From 01/01/2026 to 12/31/2026."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/fiscal/i)).not.toBeInTheDocument();
  });

  it("lists a row per sale with cost, proceeds, result and class (S64)", async () => {
    await renderApp("/portfolio/year", {
      fetch: taxYearApi([]),
      today: "2026-10-24",
    });
    const table = await results();
    await within(table).findByText("10/29/2026");
    expect(rowTexts(table)).toEqual([
      [
        "Date",
        "Security",
        "Account",
        "Quantity",
        "Cost",
        "Proceeds",
        "Result",
        "Tax class",
      ].join("|"),
      "10/29/2026|MXRF11|XP / XP MXRF11|100|R$1,008.27|R$1,042.04|+R$33.77|fii",
      `10/30/2026|PETR4|XP / XP PETR4|5|R$20.00|R$15.00|−R$5.00|${catalogEn["taxYear.unclassified"]}`,
      `11/03/2026|PETR4|XP / XP PETR4|2|$40.00|$50.00|+$10.00|${catalogEn["taxYear.unclassified"]}`,
    ]);
  });

  it("links each row to its transaction", async () => {
    await renderApp("/portfolio/year", {
      fetch: taxYearApi([]),
      today: "2026-10-24",
    });
    const table = await results();
    const link = await within(table).findByRole("link", { name: "10/29/2026" });
    expect(link).toHaveAttribute("href", `/transactions/${saleID}`);
  });

  it("totals by month and by class, one total per currency, never converted", async () => {
    await renderApp("/portfolio/year", {
      fetch: taxYearApi([]),
      today: "2026-10-24",
    });
    const byMonth = await screen.findByRole("table", {
      name: catalogEn["taxYear.totals.month"],
    });
    expect(rowTexts(byMonth).slice(1)).toEqual([
      "October|+R$28.77",
      "November|+$10.00",
    ]);
    const byClass = screen.getByRole("table", {
      name: catalogEn["taxYear.totals.class"],
    });
    expect(rowTexts(byClass).slice(1)).toEqual([
      "fii|+R$33.77",
      `${catalogEn["taxYear.unclassified"]}|−R$5.00`,
      `${catalogEn["taxYear.unclassified"]}|+$10.00`,
    ]);
  });

  it("opens the year of the address and steps it with the selector", async () => {
    const years: string[] = [];
    const { router } = await renderApp("/portfolio/year?year=2025", {
      fetch: taxYearApi(years),
      today: "2026-10-24",
    });
    await results();
    expect(years).toEqual(["2025"]);
    expect(screen.getByRole("spinbutton", { name: "Year" })).toHaveValue(
      "2025",
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Increase" }));
    await waitFor(() => {
      expect(years).toEqual(["2025", "2026"]);
    });
    expect(router.state.location.search).toEqual({ year: 2026 });
  });

  it("falls back to the app clock year when the address holds a year out of range", async () => {
    const years: string[] = [];
    await renderApp("/portfolio/year?year=1800", {
      fetch: taxYearApi(years),
      today: "2026-10-24",
    });
    await results();
    expect(years).toEqual(["2026"]);
  });

  it("says the year has no sales", async () => {
    await renderApp("/portfolio/year", {
      fetch: taxYearApi([], {}, []),
      today: "2026-10-24",
    });
    expect(
      await screen.findByText(catalogEn["taxYear.realized.empty"]),
    ).toBeInTheDocument();
  });

  it("shows the query error with a retry", async () => {
    await renderApp("/portfolio/year", {
      fetch: taxYearApi([], {
        "GET /api/v1/realized-results": () => problem(500, "internal"),
      }),
      today: "2026-10-24",
    });
    expect(
      await screen.findByRole("button", { name: catalogEn["common.retry"] }),
    ).toBeInTheDocument();
  });

  it("formats by the active region with no jurisdiction, no class and no Brazilian value", async () => {
    localStorage.setItem(
      "equori.locale",
      JSON.stringify({ language: "en", region: "DE" }),
    );
    const eur = (amount: number) => ({ amount, currency: "EUR" });
    const fetch = taxYearApi(
      [],
      {
        "GET /api/v1/settings": () => json(200, { base_currency: "EUR" }),
        "GET /api/v1/instruments": () =>
          json(200, {
            items: [
              { code: "EUR", type: "currency", scale: 2, name: "Euro" },
              { code: "SAP", type: "stock", scale: 0, name: "SAP" },
            ],
          }),
      },
      [
        {
          ...{
            transaction_id: saleID,
            account_id: "00000000-0000-4000-8000-000000000000",
            instrument: "SAP",
            date: "2026-03-15",
            month: "2026-03",
            quantity: { amount: 3, currency: "SAP" },
          },
          cost: eur(300000),
          proceeds: eur(412345),
          result: eur(112345),
          tax_class: null,
        },
      ],
    );
    const { container } = await renderApp("/portfolio/year", {
      fetch,
      today: "2026-10-24",
    });
    const table = await results();
    await within(table).findByText("15/03/2026");
    expect(rowTexts(table)[1]).toContain("€3,000.00");
    expect(rowTexts(table)[1]).toContain("+€1,123.45");
    expect(rowTexts(table)[1]).toContain(catalogEn["taxYear.unclassified"]);
    expect(container.textContent).not.toMatch(/R\$|BRL/);
  });

  it("masks every amount in privacy mode", async () => {
    hideAmounts();
    const { container } = await renderApp("/portfolio/year", {
      fetch: taxYearApi([]),
      today: "2026-10-24",
    });
    const table = await results();
    await within(table).findByText("10/29/2026");
    expectNoAmounts(container, ["33.77", "1,008.27"]);
  });
});
