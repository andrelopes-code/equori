import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { calculatorApiRoutes } from "@/testing/calculator-api";
import { fakeApi } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

async function result(label: string): Promise<string> {
  const term = await screen.findByText(label, { selector: "dt" });
  return term.parentElement?.querySelector("dd")?.textContent ?? "";
}

// The figure of the answer, after the lead the screen states.
async function figure(lead: string): Promise<string> {
  const node = await screen.findByText(lead);
  return node.nextElementSibling?.textContent ?? "";
}

// The widths of the parts of each bar row, as numbers.
async function rows(): Promise<number[][]> {
  const found = await screen.findAllByRole("img");
  return found.map((row) =>
    Array.from(row.children[1]?.children ?? []).map((part) =>
      parseFloat((part as HTMLElement).style.inlineSize),
    ),
  );
}

const home =
  "price=50000000&rent=4800000&riskFree=10&propertyTax=1&mortgage=11&maintenance=1.5&appreciation=4&riskPremium=2";

const open = (search: string) =>
  renderApp(`/calculators/own-or-rent?${search}`, {
    fetch: fakeApi(calculatorApiRoutes()),
  });

describe("Own or rent calculator", () => {
  it("leads with the cheaper option, the yearly difference and both costs", async () => {
    await open(home);
    // 52,500.00 owning against 48,000.00 of rent: renting costs 4,500.00 less.
    expect(await figure(catalogEn["calc.own.answer.leadRent"])).toContain(
      "4,500.00",
    );
    expect(await result(catalogEn["calc.own.total"])).toContain("52,500.00");
    expect(await result(catalogEn["calc.own.rentYear"])).toContain("48,000.00");
    expect(
      await screen.findByText(
        /^a year: owning costs .*52,500\.00 and renting, .*48,000\.00\.$/,
      ),
    ).toBeInTheDocument();
  });

  it("keeps the six components reachable and the formula in the method", async () => {
    await open(home);
    expect(await result(catalogEn["calc.own.forgone"])).toContain("50,000.00");
    expect(await result(catalogEn["calc.own.appreciation"])).toContain(
      "20,000.00",
    );
    expect(await result(catalogEn["calc.own.deduction"])).toContain("0.00");
    await userEvent
      .setup()
      .click(
        screen.getByRole("button", { name: catalogEn["calc.method.open"] }),
      );
    expect(
      screen.getByText(catalogEn["calc.own-or-rent.formula1"]),
    ).toBeInTheDocument();
  });

  it("leads with owning when it is the cheaper", async () => {
    await open(home.replace("rent=4800000", "rent=6000000"));
    // 60,000.00 of rent against 52,500.00 owning: 7,500.00 less.
    expect(await figure(catalogEn["calc.own.answer.leadOwn"])).toContain(
      "7,500.00",
    );
  });

  it("states an equal row with the zero amount", async () => {
    await open(home.replace("rent=4800000", "rent=5250000"));
    expect(await figure(catalogEn["calc.own.answer.leadEqual"])).toContain(
      "0.00",
    );
  });

  it("names the missing inputs while the answer is empty", async () => {
    await open("");
    expect(
      await screen.findByText(
        /^Fill in house price, annual rent, .* to see the cheaper option\.$/,
      ),
    ).toBeInTheDocument();
  });

  it("draws owning as six parts, renting as one, on one axis", async () => {
    await open(home);
    const [own, rent] = await rows();
    // Owning costs 5,250,000 net, the largest bar: 7 digits, the axis steps by 200,000 and rounds
    // up to 5,400,000. The positive components (7,250,000) are scaled to the net, so the row is
    // 5,250,000 / 5,400,000 = 97.2222% long: forgone 3,620,689 is 67.0498%, property tax
    // 362,068 is 6.7050%, maintenance 543,103 is 10.0575%, risk premium 724,140 is 13.4100%.
    // Rent 4,800,000 is 88.8889%.
    expect(own).toHaveLength(6);
    expect(rent).toHaveLength(1);
    expect(own?.[0]).toBeCloseTo(67.0498, 3);
    expect(own?.[1]).toBeCloseTo(6.705, 3);
    expect(own?.[3]).toBeCloseTo(10.0575, 3);
    expect(own?.[5]).toBeCloseTo(13.41, 3);
    expect(own?.reduce((sum, width) => sum + width, 0)).toBeCloseTo(97.2222, 3);
    expect(rent?.[0]).toBeCloseTo(88.8889, 3);
  });

  it("draws the appreciation, which lowers the cost, as a zero width", async () => {
    await open(home);
    const [own] = await rows();
    expect(own?.[4]).toBe(0);
    expect(own?.[2]).toBe(0);
    expect(own?.every((width) => width >= 0)).toBe(true);
  });

  it("draws no owning bar when the appreciation exceeds the costs", async () => {
    await open(home.replace("appreciation=4", "appreciation=20"));
    const [own, rent] = await rows();
    // Owning nets -27,500.00: every width is 0; rent 4,800,000 on its own axis is 100%.
    expect(own).toEqual([0, 0, 0, 0, 0, 0]);
    expect(rent?.[0]).toBeCloseTo(100, 3);
  });

  it("names the six components as the legend of the owning bar", async () => {
    await open(home);
    await screen.findAllByRole("img");
    const legend = document.querySelector(
      '[data-part="split"] [data-part="legend"]',
    );
    for (const key of [
      "calc.own.forgone",
      "calc.own.propertyTaxCost",
      "calc.own.deduction",
      "calc.own.maintenance",
      "calc.own.appreciation",
      "calc.own.riskPremium",
    ] as const)
      expect(legend?.textContent).toContain(catalogEn[key]);
  });

  it("keeps the deduction group closed until added and without the answer changing", async () => {
    await open(home.replace("&mortgage=11", ""));
    await figure(catalogEn["calc.own.answer.leadRent"]);
    expect(
      screen.getByRole("button", {
        name: catalogEn["calc.own.deductible.add"],
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: catalogEn["calc.own.mortgage"] }),
    ).toBeNull();
  });

  it("opens the deduction group from the address and clears it on removal", async () => {
    const user = userEvent.setup();
    await open(`${home}&deductibleTax=30`);
    expect(
      await screen.findByRole("textbox", {
        name: catalogEn["calc.own.deductibleTax"],
      }),
    ).toHaveValue("30");
    // 500,000.00 * 30% * (11% + 1%) = 18,000.00 deducted: owning costs 34,500.00.
    expect(await result(catalogEn["calc.own.total"])).toContain("34,500.00");
    await user.click(
      screen.getByRole("button", {
        name: catalogEn["calc.own.deductible.remove"],
      }),
    );
    expect(
      await screen.findByRole("button", {
        name: catalogEn["calc.own.deductible.add"],
      }),
    ).toBeInTheDocument();
    expect(await result(catalogEn["calc.own.total"])).toContain("52,500.00");
  });
});
