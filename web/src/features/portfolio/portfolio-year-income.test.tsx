import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { json, problem } from "@/testing/fake-api";
import { hideAmounts, expectNoAmounts } from "@/testing/privacy";
import { renderApp } from "@/testing/render-app";
import { dividendTxID, taxYearApi } from "@/testing/tax-year-api";

const rowTexts = (table: HTMLElement) =>
  within(table)
    .getAllByRole("row")
    .map((row) =>
      [...row.querySelectorAll('[role="cell"], [role="columnheader"], th, td')]
        .map((cell) => cell.textContent)
        .join("|"),
    );

const income = () =>
  screen.findByRole("table", { name: catalogEn["taxYear.income.title"] });

const open = (years: string[] = [], path = "/portfolio/year?tab=income") =>
  renderApp(path, { fetch: taxYearApi(years), today: "2026-10-24" });

describe("Tax year income events", () => {
  afterEach(() => {
    localStorage.removeItem("equori.locale");
    localStorage.removeItem("equori.privacy");
  });

  it("lists gross, withheld and net of each event with its type and treatment (S65)", async () => {
    await open();
    const table = await income();
    await within(table).findByText("10/15/2026");
    expect(rowTexts(table)).toEqual([
      [
        "Date",
        "Security",
        "Account",
        "Income type",
        "Tax treatment",
        "Gross",
        "Withheld",
        "Net",
      ].join("|"),
      "10/15/2026|MXRF11|XP / XP MXRF11|Dividend|Exempt|R$10.00|R$0.00|R$10.00",
      "10/20/2026|PETR4|XP / XP PETR4|Interest on equity|Exclusive|R$45.00|R$6.75|R$38.25",
      `11/02/2026|PETR4|XP / XP PETR4|royalty|${catalogEn["taxYear.unclassified"]}|$20.00|$3.00|$17.00`,
    ]);
  });

  it("links each row to its transaction", async () => {
    await open();
    const table = await income();
    const link = await within(table).findByRole("link", { name: "10/15/2026" });
    expect(link).toHaveAttribute("href", `/transactions/${dividendTxID}`);
  });

  it("totals by treatment and by type, one total per currency", async () => {
    await open();
    const byTreatment = await screen.findByRole("table", {
      name: catalogEn["taxYear.income.totals.treatment"],
    });
    expect(rowTexts(byTreatment)).toEqual([
      "Tax treatment|Gross|Withheld|Net",
      "Exclusive|R$45.00|R$6.75|R$38.25",
      "Exempt|R$10.00|R$0.00|R$10.00",
      `${catalogEn["taxYear.unclassified"]}|$20.00|$3.00|$17.00`,
    ]);
    const byType = screen.getByRole("table", {
      name: catalogEn["taxYear.income.totals.type"],
    });
    expect(rowTexts(byType).slice(1)).toEqual([
      "Dividend|R$10.00|R$0.00|R$10.00",
      "Interest on equity|R$45.00|R$6.75|R$38.25",
      "royalty|$20.00|$3.00|$17.00",
    ]);
  });

  it("reads the year of the address and says an empty year", async () => {
    const years: string[] = [];
    await renderApp("/portfolio/year?year=2025&tab=income", {
      fetch: taxYearApi(years, {}, [], []),
    });
    expect(
      await screen.findByText(catalogEn["taxYear.income.empty"]),
    ).toBeInTheDocument();
    expect(years).toEqual(["income 2025"]);
  });

  it("switches panels and keeps the panel in the address", async () => {
    const years: string[] = [];
    const { router } = await open(years, "/portfolio/year");
    await screen.findByRole("table", {
      name: catalogEn["taxYear.realized.title"],
    });
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("tab", { name: catalogEn["taxYear.tab.income"] }),
    );
    await income();
    expect(router.state.location.search).toEqual({ tab: "income" });
    await user.click(
      screen.getByRole("tab", { name: catalogEn["taxYear.tab.realized"] }),
    );
    await waitFor(() => {
      expect(router.state.location.search).toEqual({});
    });
  });

  it("fails on its own: the realized results stay on screen", async () => {
    await renderApp("/portfolio/year?tab=income", {
      fetch: taxYearApi([], {
        "GET /api/v1/income-events": () => problem(500, "internal"),
      }),
    });
    expect(
      await screen.findByRole("button", { name: catalogEn["common.retry"] }),
    ).toBeInTheDocument();
  });

  it("formats by the active region with no jurisdiction and no Brazilian value", async () => {
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
      [],
      [
        {
          transaction_id: dividendTxID,
          account_id: "00000000-0000-4000-8000-000000000000",
          instrument: "SAP",
          date: "2026-05-12",
          income_type: "dividend",
          tax_treatment: null,
          gross: eur(123456),
          withheld: eur(30864),
        },
      ],
    );
    const { container } = await renderApp("/portfolio/year?tab=income", {
      fetch,
      today: "2026-10-24",
    });
    const table = await income();
    await within(table).findByText("12/05/2026");
    const row = rowTexts(table)[1] ?? "";
    expect(row).toContain("€1,234.56");
    expect(row).toContain("€308.64");
    expect(row).toContain("€925.92");
    expect(row).toContain(catalogEn["taxYear.unclassified"]);
    expect(container.textContent).not.toMatch(/R\$|BRL|Exempt|Exclusive/);
  });

  it("masks every amount in privacy mode", async () => {
    hideAmounts();
    const { container } = await open();
    const table = await income();
    await within(table).findByText("10/15/2026");
    expectNoAmounts(container, ["45.00", "6.75", "38.25"]);
  });
});
