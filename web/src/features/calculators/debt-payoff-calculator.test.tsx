import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { debtApiRoutes } from "@/testing/calculator-api";
import { fakeApi } from "@/testing/fake-api";
import { expectNoAmounts, hideAmounts } from "@/testing/privacy";
import { renderApp } from "@/testing/render-app";

const open = (search = "") =>
  renderApp(`/calculators/debt-payoff${search}`, {
    fetch: fakeApi(debtApiRoutes()),
  });

const debts =
  "?debts=card~100000~3~5000;loan~300000~1~10000;store~50000~2~2500&budget=30000";

const label = (key: "calc.debt.name" | "calc.debt.rate", n: number) =>
  catalogEn[key].replace("{n}", String(n));

describe("Debt payoff calculator", () => {
  afterEach(() => {
    localStorage.removeItem("equori.privacy");
  });

  it("fills a row from each loan and card that owes an amount", async () => {
    await open();
    expect(
      await screen.findByRole("textbox", { name: label("calc.debt.name", 1) }),
    ).toHaveValue("Visa");
    expect(
      screen.getByRole("textbox", { name: label("calc.debt.name", 2) }),
    ).toHaveValue("Car loan");
    expect(
      screen.queryByRole("textbox", { name: label("calc.debt.name", 3) }),
    ).toBeNull();
    expect(screen.getAllByText(/^From your data:/)).toHaveLength(2);
    expect(
      screen.getByRole("textbox", { name: label("calc.debt.rate", 1) }),
    ).toHaveValue("");
  });

  it("compares the avalanche and the snowball", async () => {
    await open(debts);
    const table = await screen.findByRole("table", {
      name: catalogEn["calc.debt.compare"],
    });
    const row = (name: string) =>
      within(table).getByRole("rowheader", { name }).closest("tr")
        ?.textContent ?? "";
    expect(row(catalogEn["calc.debt.months"])).toBe(
      `${catalogEn["calc.debt.months"]}1717`,
    );
    expect(row(catalogEn["calc.debt.interest"])).toContain("527.80");
    expect(row(catalogEn["calc.debt.interest"])).toContain("556.52");
    expect(row(catalogEn["calc.debt.closes"].replace("{name}", "card"))).toBe(
      `${catalogEn["calc.debt.closes"].replace("{name}", "card")}79`,
    );
    const term = await screen.findByText(
      catalogEn["calc.debt.avalancheLower"],
      {
        selector: "dt",
      },
    );
    expect(term.parentElement?.textContent).toContain("28.72");
  });

  it("makes no plan below the sum of the minimums", async () => {
    await open(debts.replace("budget=30000", "budget=17000"));
    expect(
      await screen.findByText(catalogEn["calc.debt.belowMinimums"]),
    ).toBeInTheDocument();
  });

  it("masks the amounts of the results in privacy mode", async () => {
    hideAmounts();
    await open(debts);
    await screen.findByRole("table", { name: catalogEn["calc.debt.compare"] });
    expectNoAmounts(
      screen.getByRole("region", { name: catalogEn["calc.results"] }),
      ["527.80", "556.52"],
    );
  });
});
