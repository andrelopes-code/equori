import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";
import { taxYearApi } from "@/testing/tax-year-api";

const brl = (amount: number) => ({ amount, currency: "BRL" });

const dayTrade = (base: number, due: number) => ({
  pool: "day_trade",
  gross: brl(0),
  result: brl(base),
  exempt: brl(0),
  loss_used: brl(0),
  loss_carried: brl(0),
  base: brl(base),
  rate_bp: 2000,
  tax: brl(due),
  withheld: brl(0),
  due: brl(due),
});

// S629 through the screen: the day trade of March owes 7.60, carried to the payment of April.
const months = [
  {
    month: "2026-03",
    lines: [dayTrade(4000, 760)],
    carried_in: brl(0),
    darf: brl(0),
    crypto_carried_in: brl(0),
    crypto_darf: brl(0),
  },
  {
    month: "2026-04",
    lines: [dayTrade(10000, 1900)],
    carried_in: brl(760),
    darf: brl(2660),
    crypto_carried_in: brl(0),
    crypto_darf: brl(0),
  },
];

const rowTexts = (table: HTMLElement) =>
  within(table)
    .getAllByRole("row")
    .map((row) =>
      [...row.querySelectorAll('[role="cell"], [role="columnheader"], th, td')]
        .map((cell) => cell.textContent)
        .join("|"),
    );

const open = (items: unknown[]) =>
  renderApp("/portfolio/year?tab=gain_tax", {
    fetch: taxYearApi([], {
      "GET /api/v1/gain-tax": () =>
        json(200, { from: "2026-01-01", to: "2026-12-31", items }),
    }),
    today: "2026-10-24",
  });

describe("Tax year monthly tax (GT9)", () => {
  it("states what to pay each month, then the tax of each group", async () => {
    await open(months);

    const pay = await screen.findByRole("table", {
      name: catalogEn["taxYear.gainTax.darf"],
    });
    expect(rowTexts(pay)).toEqual([
      "Month|Carried in|To pay",
      "March|R$0.00|R$0.00",
      "April|R$7.60|R$26.60",
    ]);

    const pools = screen.getByRole("table", {
      name: catalogEn["taxYear.gainTax.pools"],
    });
    expect(rowTexts(pools)).toEqual([
      "Month and group|Taxable base|Rate|Due after withholding",
      "March · Day trade|R$40.00|20%|R$7.60",
      "April · Day trade|R$100.00|20%|R$19.00",
    ]);
  });

  it("says when the year has no monthly tax", async () => {
    await open([]);

    expect(
      await screen.findByText(catalogEn["taxYear.gainTax.empty"]),
    ).toBeInTheDocument();
  });
});
