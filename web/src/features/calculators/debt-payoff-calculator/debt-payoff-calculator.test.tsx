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
  "?debts=card~100000~3~5000;loan~300000~1~10000;store~50000~2~2500&budget=30000&ratePeriod=month";

async function result(label: string): Promise<string> {
  const term = await screen.findByText(label, { selector: "dt" });
  return term.parentElement?.querySelector("dd")?.textContent ?? "";
}

// The figure of the answer, after the lead the screen states.
async function figure(lead: string): Promise<string> {
  const node = await screen.findByText(lead);
  return node.nextElementSibling?.textContent ?? "";
}

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

  it("opens filled from the address and names the order with less interest", async () => {
    await open(debts);
    // Avalanche 52780 and snowball 55652 minor units: 55652 - 52780 = 2872.
    expect(
      await figure(
        catalogEn["calc.debt.answer.lead"].replace(
          "{order}",
          catalogEn["calc.debt.avalanche"],
        ),
      ),
    ).toContain("28.72");
    expect(
      screen.getByText(
        /less than snowball, with the last payment in 17 months\./,
      ),
    ).toBeInTheDocument();
  });

  it("states the last payment of each order as a fact", async () => {
    await open(debts);
    const months = (order: string) =>
      result(catalogEn["calc.debt.answer.months"].replace("{order}", order));
    expect(await months(catalogEn["calc.debt.avalanche"])).toBe("17");
    expect(await months(catalogEn["calc.debt.snowball"])).toBe("17");
  });

  it("draws the interest of each order and the month each debt closes", async () => {
    await open(debts);
    expect(
      await screen.findByRole("img", { name: /^Avalanche .*527\.80/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /^Snowball .*556\.52/ }),
    ).toBeInTheDocument();
    const table = screen.getByRole("table", {
      name: catalogEn["calc.debt.compare"],
    });
    const closes = catalogEn["calc.debt.closes"].replace("{name}", "card");
    expect(
      within(table).getByRole("rowheader", { name: closes }).closest("tr")
        ?.textContent,
    ).toBe(`${closes}79`);
  });

  it("states that the orders pay the same interest for one debt", async () => {
    // 3000 + 2190 + 1356 + 496 = 7042 minor units in 4 months, in both orders.
    await open("?debts=card~100000~3~5000&budget=30000&ratePeriod=month");
    expect(await figure(catalogEn["calc.debt.answer.leadEqual"])).toContain(
      "70.42",
    );
    expect(
      screen.getByText(catalogEn["calc.debt.answer.equal"]),
    ).toBeInTheDocument();
    const months = catalogEn["calc.debt.answer.months"];
    expect(
      await result(months.replace("{order}", catalogEn["calc.debt.snowball"])),
    ).toBe("4");
  });

  it("makes no plan below the sum of the minimums", async () => {
    await open(debts.replace("budget=30000", "budget=17000"));
    expect(
      await screen.findByText(catalogEn["calc.debt.belowMinimums"]),
    ).toBeInTheDocument();
    expect(await figure(catalogEn["calc.debt.answer.leadEqual"])).toBe("—");
  });

  it("warns under the answer when a debt is never closed", async () => {
    // 3% of 1000.00 is 30.00, the whole budget.
    await open("?debts=card~100000~3~3000&budget=3000&ratePeriod=month");
    expect(
      await screen.findByText(catalogEn["calc.debt.notClosed"]),
    ).toBeInTheDocument();
    expect(await figure(catalogEn["calc.debt.answer.leadEqual"])).toBe("—");
    expect(
      await result(
        catalogEn["calc.debt.answer.months"].replace(
          "{order}",
          catalogEn["calc.debt.avalanche"],
        ),
      ),
    ).toBe(catalogEn["calc.debt.notClosedCell"]);
  });

  it("names every missing input before the answer", async () => {
    await open("?debts=");
    expect(
      await screen.findByText(
        /^Fill in monthly budget for the debts and debts to see/,
      ),
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
