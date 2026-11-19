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

// The figure of the answer.
async function figure(): Promise<string> {
  const lead = await screen.findByText(
    catalogEn["calc.fixedIncome.answer.lead"],
  );
  return lead.nextElementSibling?.textContent ?? "";
}

// The widths of the parts of the first bar row.
async function parts(): Promise<string[]> {
  const row = (await screen.findAllByRole("img"))[0];
  const track = row?.children[1];
  return Array.from(track?.children ?? []).map(
    (part) => (part as HTMLElement).style.inlineSize,
  );
}

const open = (search: string, region: string, language = "en") =>
  renderApp(`/calculators/fixed-income?${search}`, {
    fetch: fakeApi({
      ...calculatorApiRoutes(),
      "GET /api/v1/me": () =>
        json(200, {
          id: 1,
          email: "a@b.c",
          role: "admin",
          language,
          region,
        }),
    }),
  });

describe("Fixed income calculator", () => {
  it("takes the Brazilian tax of the holding period", async () => {
    await open("amount=1000000&rate=12&days=400", "BR");
    expect(await figure()).toMatch(/1[.,]090[.,]96/);
    // The tier of 361 to 720 days.
    expect(await result(catalogEn["calc.fixedIncome.taxShare"])).toMatch(
      /^17[.,]5/,
    );
    expect(await result(catalogEn["calc.fixedIncome.gross"])).toMatch(
      /1[.,]322[.,]38/,
    );
    expect(await result(catalogEn["calc.fixedIncome.tax"])).toMatch(
      /231[.,]42/,
    );
  });

  it("gives no result below 30 days in Brazil, where IOF applies", async () => {
    await open("amount=1000000&rate=12&days=20", "BR");
    expect(
      await screen.findByText(catalogEn["calc.fixedIncome.iof"]),
    ).toBeInTheDocument();
    expect(await figure()).toBe("—");
    expect(screen.queryByText(catalogEn["calc.fixedIncome.gross"])).toBeNull();
  });

  it("applies the German rate of 26.375% with no tax rate to type", async () => {
    await open("amount=1000000&rate=12&days=400", "DE");
    // A gross yield of 1,322.38 times 26.375%.
    expect(await result(catalogEn["calc.fixedIncome.tax"])).toMatch(
      /348[.,]78/,
    );
    expect(
      screen.queryByRole("textbox", {
        name: catalogEn["calc.fixedIncome.taxRate"],
      }),
    ).toBeNull();
  });

  it("asks for the tax rate in a region without a rule", async () => {
    await open("amount=1000000&rate=12&days=400&taxRate=17.5", "ES");
    expect(
      await screen.findByRole("textbox", {
        name: catalogEn["calc.fixedIncome.taxRate"],
      }),
    ).toHaveValue("17,5");
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
    await screen.findByText(catalogEn["calc.fixedIncome.equivalentTaxable"]);
    expect(
      screen.queryByText(catalogEn["calc.fixedIncome.taxShare"]),
    ).toBeNull();
    // The tax part of the bar is empty: one part is visible.
    const widths = await parts();
    expect(widths).toHaveLength(2);
    expect(widths[0]).not.toBe("0%");
    expect(widths[1]).toBe("0%");
  });

  it("splits the yield into net and tax in one bar", async () => {
    await open("amount=1000000&rate=12&days=400", "BR");
    const [net, tax] = await parts();
    // 109,096 net and 23,142 tax of a 132,238 yield.
    expect(parseFloat(net ?? "")).toBeGreaterThan(parseFloat(tax ?? ""));
    expect(parseFloat(tax ?? "")).toBeGreaterThan(0);
  });

  it("names the fields to fill in while the answer is empty", async () => {
    await open("rate=12", "BR");
    expect(await figure()).toBe("—");
    expect(
      await screen.findByText(/^Fill in .*amount.* to see the net yield\.$/),
    ).toBeInTheDocument();
  });

  // I1: a count reads with the grouping of the locale, in the sentence and in the days hint.
  it("groups 1095 days in pt-BR", async () => {
    await open("amount=1000000&rate=12&days=1095", "BR", "pt");
    expect(await screen.findByText(/^em 1\.095 dias, /)).toBeVisible();
  });

  it("groups the days of a term in years in pt-BR", async () => {
    await open("amount=1000000&rate=12&days=3&daysUnit=year", "BR", "pt");
    expect(await screen.findByText(/^1\.096 dias corridos /)).toBeVisible();
  });
});
