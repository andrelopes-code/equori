import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { calculatorApiRoutes } from "@/testing/calculator-api";
import { fakeApi } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

async function result(label: string): Promise<string> {
  const term = await screen.findByText(label, { selector: "dt" });
  return term.parentElement?.querySelector("dd")?.textContent ?? "";
}

const open = (search: string) =>
  renderApp(`/calculators/financing?${search}`, {
    fetch: fakeApi(calculatorApiRoutes()),
  });

const loan = "amount=1000000&rate=1&period=month&months=12";

describe("Financing calculator", () => {
  it("compares Price and SAC side by side", async () => {
    await open(loan);
    const table = await screen.findByRole("table", {
      name: catalogEn["calc.financing.compare"],
    });
    const row = (label: string) =>
      within(table).getByRole("rowheader", { name: label }).closest("tr")
        ?.textContent ?? "";
    expect(row(catalogEn["calc.financing.first"])).toContain("888.49");
    expect(row(catalogEn["calc.financing.first"])).toContain("933.33");
    expect(row(catalogEn["calc.financing.last"])).toContain("888.47");
    expect(row(catalogEn["calc.financing.interest"])).toContain("661.86");
    expect(row(catalogEn["calc.financing.interest"])).toContain("650.00");
  });

  it("lists the 12 months of each system", async () => {
    await open(loan);
    for (const key of [
      "calc.financing.priceTable",
      "calc.financing.sacTable",
    ] as const) {
      const grid = await screen.findByRole("table", { name: catalogEn[key] });
      // The header row and one row per month.
      expect(within(grid).getAllByRole("row")).toHaveLength(13);
    }
  });

  it("shows what a prepayment changes", async () => {
    await open(`${loan}&prepayMonth=6&prepayAmount=200000`);
    expect(await result(catalogEn["calc.financing.prepay.balance"])).toContain(
      "3,149.20",
    );
    expect(await result(catalogEn["calc.financing.prepay.months"])).toBe("4");
    expect(
      await result(catalogEn["calc.financing.prepay.keepInstallmentInterest"]),
    ).toContain("74.20");
    expect(
      await result(catalogEn["calc.financing.prepay.installment"]),
    ).toContain("543.39");
    expect(await result(catalogEn["calc.financing.prepay.without"])).toContain(
      "181.72",
    );
  });

  it("solves the rate from the installment", async () => {
    await open("solve=rate&amount=1000000&months=12&installment=88849");
    expect(await result(catalogEn["calc.financing.solved.rate"])).toBe(
      "1.0000%",
    );
  });
});
