import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { calculatorApiRoutes } from "@/testing/calculator-api";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

async function result(label: string): Promise<string> {
  const term = await screen.findByText(label, { selector: "dt" });
  return term.parentElement?.querySelector("dd")?.textContent ?? "";
}

const open = (search: string, region: string) =>
  renderApp(`/calculators/fixed-income?${search}`, {
    fetch: fakeApi({
      ...calculatorApiRoutes(),
      "GET /api/v1/me": () =>
        json(200, {
          id: 1,
          email: "a@b.c",
          role: "admin",
          language: "en",
          region,
        }),
    }),
  });

describe("Fixed income calculator", () => {
  it("takes the Brazilian tax of the holding period", async () => {
    await open("amount=1000000&rate=12&days=400", "BR");
    expect(await result(catalogEn["calc.fixedIncome.gross"])).toMatch(
      /1[.,]322[.,]38/,
    );
    expect(await result(catalogEn["calc.fixedIncome.tax"])).toMatch(
      /231[.,]42/,
    );
    expect(await result(catalogEn["calc.fixedIncome.net"])).toMatch(
      /1[.,]090[.,]96/,
    );
  });

  it("gives no result below 30 days in Brazil, where IOF applies", async () => {
    await open("amount=1000000&rate=12&days=20", "BR");
    expect(
      await screen.findByText(catalogEn["calc.fixedIncome.iof"]),
    ).toBeInTheDocument();
    expect(screen.queryByText(catalogEn["calc.fixedIncome.gross"])).toBeNull();
  });

  it("asks for the tax rate in a region without a rule", async () => {
    await open("amount=1000000&rate=12&days=400&taxRate=17.5", "DE");
    expect(
      await screen.findByRole("textbox", {
        name: catalogEn["calc.fixedIncome.taxRate"],
      }),
    ).toHaveValue("17.5");
    expect(await result(catalogEn["calc.fixedIncome.tax"])).toMatch(
      /231[.,]42/,
    );
  });

  it("takes no tax from an exempt security", async () => {
    await open("amount=1000000&rate=12&days=400&kind=exempt", "BR");
    expect(await result(catalogEn["calc.fixedIncome.tax"])).toMatch(
      /\b0[.,]00/,
    );
    expect(
      await result(catalogEn["calc.fixedIncome.equivalentTaxable"]),
    ).not.toBe("");
  });
});
