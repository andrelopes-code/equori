import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { calculatorApiRoutes } from "@/testing/calculator-api";
import { fakeApi } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

async function result(label: string): Promise<string> {
  const term = await screen.findByText(label, { selector: "dt" });
  return term.parentElement?.querySelector("dd")?.textContent ?? "";
}

const home =
  "price=50000000&rent=4800000&riskFree=10&propertyTax=1&mortgage=11&maintenance=1.5&appreciation=4&riskPremium=2";

describe("Own or rent calculator", () => {
  it("shows the six components, the rent and the difference", async () => {
    await renderApp(`/calculators/own-or-rent?${home}`, {
      fetch: fakeApi(calculatorApiRoutes()),
    });
    expect(await result(catalogEn["calc.own.forgone"])).toContain("50,000.00");
    expect(await result(catalogEn["calc.own.appreciation"])).toContain(
      "20,000.00",
    );
    expect(await result(catalogEn["calc.own.deduction"])).toContain("0.00");
    expect(await result(catalogEn["calc.own.total"])).toContain("52,500.00");
    expect(await result(catalogEn["calc.own.rentYear"])).toContain("48,000.00");
    expect(await result(catalogEn["calc.own.rentLower"])).toContain("4,500.00");
    expect(
      screen.getByText(catalogEn["calc.own-or-rent.formula1"]),
    ).toBeInTheDocument();
  });
});
