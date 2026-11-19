import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { calculatorApiRoutes, cdiFixture } from "@/testing/calculator-api";
import { fakeApi } from "@/testing/fake-api";
import { expectNoAmounts, hideAmounts } from "@/testing/privacy";
import { renderApp } from "@/testing/render-app";

// The text of a result, found by the words that name it.
async function result(label: string): Promise<string> {
  const term = await screen.findByText(label, { selector: "dt" });
  return term.parentElement?.querySelector("dd")?.textContent ?? "";
}

// The answer of the screen: its lead, its figure, its sentence and its facts.
const answer = async () =>
  screen.findByRole("region", { name: catalogEn["calc.results"] });

async function openDetails() {
  await userEvent.click(
    await screen.findByRole("button", {
      name: new RegExp(catalogEn["calc.compound.details"]),
    }),
  );
}

const open = (search: string, indexes = calculatorApiRoutes()) =>
  renderApp(`/calculators/compound?${search}`, { fetch: fakeApi(indexes) });

describe("Compound interest calculator", () => {
  afterEach(() => {
    localStorage.removeItem("equori.privacy");
  });

  it("answers the final amount of a capital first (M1, CR3)", async () => {
    await open("initial=100000&deposit=0&months=12&rate=12.682503");
    const region = await answer();
    await within(region).findByText("R$1,126.83");
    expect(region).toHaveTextContent(
      catalogEn["calc.compound.answer.lead"].replace("{months}", "12"),
    );
    // 1,126.83 less the 1,000.00 deposited.
    expect(region).toHaveTextContent(/R\$1,000\.00 deposited earn R\$126\.83/);
  });

  it("shows the final amount in today's money (CR3)", async () => {
    await open("initial=100000&deposit=0&months=12&rate=12.682503&inflation=4");
    // 112683 / 1.04 = 108349.04
    expect(await result(catalogEn["calc.compound.real"])).toContain("1,083.49");
  });

  it("states the final amount, the delayed amount and the cost of waiting (CR3)", async () => {
    await open("initial=1000000&deposit=100000&months=120&rate=10&delay=12");
    const region = await answer();
    await within(region).findByText("R$227,395.02");
    const delayed = catalogEn["calc.compound.answer.delayed"].replace(
      "{months}",
      "12",
    );
    expect(await result(delayed)).toBe("R$195,231.36");
    expect(await result(catalogEn["calc.compound.answer.wait"])).toBe(
      "R$32,163.66",
    );
  });

  it("starts without a delay until it is asked for (CR7)", async () => {
    await open("initial=0&deposit=10000&months=24&rate=12.682503");
    await answer();
    expect(
      screen.queryByText(catalogEn["calc.compound.answer.wait"]),
    ).toBeNull();
    expect(
      screen.getByRole("button", {
        name: catalogEn["calc.compound.delay.add"],
      }),
    ).toBeInTheDocument();
  });

  it("finds the deposit for a target (CR3)", async () => {
    await open("mode=target&target=123972&initial=0&months=12&rate=6.167781");
    const region = await answer();
    expect(region).toHaveTextContent(catalogEn["calc.compound.target.lead"]);
    await within(region).findByText("R$100.00");
  });

  it("answers the income that keeps the assets in the income mode (CR3)", async () => {
    await open("mode=income&initial=100000&rate=12.682503&months=12");
    expect(await answer()).toHaveTextContent(
      catalogEn["calc.compound.income.lead"],
    );
  });

  it("names the inputs still missing in the answer (CR4)", async () => {
    await open("initial=100000&months=abc&rate=12");
    const region = await answer();
    expect(region).toHaveTextContent(catalogEn["calc.compound.answer.what"]);
    expect(region).toHaveTextContent("—");
  });

  it("draws no footnote under the figures (CR9)", async () => {
    await open("initial=100000&deposit=0&months=12&rate=12");
    await answer();
    expect(screen.queryByText(/^An estimate:/)).toBeNull();
  });

  it("keeps the balance chart and table inside the closed details (CR8)", async () => {
    await open("initial=100000&deposit=0&months=12&rate=12");
    await answer();
    const trigger = await screen.findByRole("button", {
      name: new RegExp(catalogEn["calc.compound.details"]),
    });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await openDetails();
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const table = await screen.findByRole("table", {
      name: catalogEn["calc.compound.details"],
    });
    expect(table).toBeVisible();
    // Month 1 holds the 1,000.00 deposited, in the third column.
    expect(cellsOf(within(table).getAllByRole("row"), 1)[0]).toBe("1");
    expect(cellsOf(within(table).getAllByRole("row"), 1)[2]).toBe("R$1,000.00");
  });

  it("shows where the final amount comes from (CR5)", async () => {
    await open("initial=100000&deposit=0&months=12&rate=12.682503");
    await screen.findByText(catalogEn["calc.compound.split.title"]);
    expect(
      screen.getByRole("img", {
        name: /Final amount: Deposited R\$1,000\.00, Interest R\$126\.83/,
      }),
    ).toBeInTheDocument();
  });

  it("works without indexes", async () => {
    await open("initial=100000&months=12&rate=12");
    await answer();
    expect(
      screen.queryByRole("radiogroup", {
        name: catalogEn["calc.compound.rateSource"],
      }),
    ).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("fills the annual rate from a percent of a daily index", async () => {
    const user = userEvent.setup();
    await open("initial=100000&months=12", calculatorApiRoutes([cdiFixture()]));
    const source = await screen.findByRole("radiogroup", {
      name: catalogEn["calc.compound.rateSource"],
    });
    await user.click(within(source).getByRole("radio", { name: "CDI" }));
    // 261 days at 0.04% from 2025-10-17 to 2026-10-16.
    const rate = await screen.findByRole("textbox", {
      name: catalogEn["calc.compound.rate"],
    });
    await waitFor(() => {
      expect(rate).toHaveValue("11.0021");
    });
    const field = rate.closest('[data-ui="field"]');
    expect(field).not.toBeNull();
    expect(
      within(field as HTMLElement).getByText(/^From your data:/),
    ).toBeInTheDocument();
    await user.clear(rate);
    await user.type(rate, "10");
    expect(screen.queryByText(/^From your data:/)).toBeNull();
  });

  it("states the monthly income the final amount pays after inflation (CR3)", async () => {
    await open(
      "initial=100000&months=12&rate=12.682503&inflation=4&withdraw=10",
    );
    // 1,126.83 at 1% a month against 4% a year of inflation (0.3274% a month).
    expect(await result(catalogEn["calc.compound.rows.same"])).toContain(
      "7.58",
    );
    // The same income less a year of inflation: 7.58 / 1.04.
    expect(await result(catalogEn["calc.compound.rows.lasting"])).toContain(
      "7.29",
    );
    // Spent over 10 years with an income that follows inflation.
    expect(await result(catalogEn["calc.compound.income.spending"])).toContain(
      "13.21",
    );
  });

  it("splits the income that keeps the balance into reinvested and living parts (CR3)", async () => {
    await open("initial=100000&months=12&rate=12.682503");
    // 1,126.83 at 1% a month pays 11.27: a quarter is reinvested, the rest is lived on.
    expect(
      await result(
        catalogEn["calc.compound.rows.reinvest"].replace("{share}", "25%"),
      ),
    ).toContain("2.82");
    expect(
      await result(
        catalogEn["calc.compound.rows.living"].replace("{share}", "75%"),
      ),
    ).toContain("8.45");
  });

  it("states that no income keeps the purchasing power above the rate", async () => {
    await open("initial=100000&months=12&rate=3&inflation=4");
    expect(
      await screen.findByText(catalogEn["calc.compound.income.none"]),
    ).toBeInTheDocument();
  });

  it("masks every computed amount and keeps the rate in privacy mode", async () => {
    hideAmounts();
    await open(
      "initial=100000&deposit=10000&months=12&rate=12.682503&inflation=4",
    );
    await answer();
    expectNoAmounts(
      screen.getByRole("region", { name: catalogEn["calc.results"] }),
      ["1,126.83"],
    );
    expect(
      screen.getByRole("textbox", { name: catalogEn["calc.compound.rate"] }),
    ).toHaveValue("12.682503");
  });

  it("shows the range of outcomes only with a volatility (CR5)", async () => {
    const { unmount } = await open(
      "initial=100000&deposit=10000&months=12&rate=12",
    );
    await answer();
    expect(screen.queryByText(catalogEn["calc.compound.range.low"])).toBeNull();
    unmount();
    await open("initial=100000&deposit=10000&months=12&rate=12&volatility=20");
    for (const key of [
      "calc.compound.range.low",
      "calc.compound.range.mid",
      "calc.compound.range.high",
    ] as const)
      expect(await result(catalogEn[key])).toMatch(/\d/);
    const [low, mid, high] = await Promise.all(
      (
        [
          "calc.compound.range.low",
          "calc.compound.range.mid",
          "calc.compound.range.high",
        ] as const
      ).map(async (key) =>
        Number((await result(catalogEn[key])).replace(/[^\d.]/g, "")),
      ),
    );
    expect(low).toBeLessThan(mid ?? 0);
    expect(mid).toBeLessThan(high ?? 0);
  });

  it("lives on the income and reinvests a share, month by month", async () => {
    await open(
      "mode=income&initial=100000000&period=month&rate=1&months=2&monthsUnit=month&share=25",
    );
    await answer();
    await openDetails();
    const monthly = await screen.findByRole("table", {
      name: catalogEn["calc.compound.live.monthly"],
    });
    const rows = within(monthly).getAllByRole("row");

    // Month 1: 1,000,000.00 × 1% = 10,000.00; 25% reinvested, the rest spent.
    expect(cellsOf(rows, 1)).toEqual([
      "1",
      "R$1,000,000.00",
      "R$10,000.00",
      "R$2,500.00",
      "R$7,500.00",
      "R$1,002,500.00",
    ]);
    // Month 2 earns on the balance plus the reinvested part.
    expect(cellsOf(rows, 2)).toEqual([
      "2",
      "R$1,002,500.00",
      "R$10,025.00",
      "R$2,506.25",
      "R$7,518.75",
      "R$1,005,006.25",
    ]);
    expect(await result(catalogEn["calc.compound.live.final"])).toContain(
      "1,005,006.25",
    );
  });

  it("answers the income of the balance, its parts and the closing balance (CR3)", async () => {
    await open(
      "mode=income&initial=100000000&period=month&rate=1&months=2&monthsUnit=month&share=25",
    );
    const region = await answer();
    await within(region).findByText("R$10,000.00");
    // A quarter of 10,000.00 is reinvested; the closing balance is month 2's.
    expect(region).toHaveTextContent("R$2,500.00");
    expect(region).toHaveTextContent("R$7,500.00");
    // 1,005,006.25 closing less the 1,000,000.00 opening.
    expect(await result(catalogEn["calc.compound.live.growth"])).toBe(
      "R$5,006.25",
    );
    // 7,500.00 and 7,518.75 lived on; 2,500.00 and 2,506.25 reinvested.
    expect(await result(catalogEn["calc.compound.live.totalLiving"])).toBe(
      "R$15,018.75",
    );
    expect(await result(catalogEn["calc.compound.live.totalReinvested"])).toBe(
      "R$5,006.25",
    );
  });

  it("shows no income table while the share is above 100", async () => {
    await open("mode=income&initial=100000000&rate=12&months=2&share=101");
    await screen.findByText(catalogEn["calc.compound.live.share"]);
    expect(
      screen.queryByRole("table", {
        name: catalogEn["calc.compound.live.monthly"],
      }),
    ).toBeNull();
  });
});

// The text of each cell of one row of a table, in order.
function cellsOf(rows: HTMLElement[], index: number): (string | null)[] {
  return Array.from(rows[index]?.children ?? []).map((c) => c.textContent);
}
