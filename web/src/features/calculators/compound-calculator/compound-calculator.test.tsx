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

const open = (search: string, indexes = calculatorApiRoutes()) =>
  renderApp(`/calculators/compound?${search}`, { fetch: fakeApi(indexes) });

describe("Compound interest calculator", () => {
  afterEach(() => {
    localStorage.removeItem("equori.privacy");
  });

  it("shows the final amount of a capital (M1)", async () => {
    await open("initial=100000&deposit=0&months=12&rate=12.682503");
    expect(await result(catalogEn["calc.compound.final"])).toContain(
      "1,126.83",
    );
    expect(await result(catalogEn["calc.compound.interest"])).toContain(
      "126.83",
    );
  });

  it("shows the final amount in today's money", async () => {
    await open("initial=100000&deposit=0&months=12&rate=12.682503&inflation=4");
    // 112683 / 1.04 = 108349.04
    expect(await result(catalogEn["calc.compound.real"])).toContain("1,083.49");
  });

  it("shows the amount when starting after a delay, and the difference", async () => {
    await open("initial=0&deposit=10000&months=24&rate=12.682503&delay=12");
    const delayed = catalogEn["calc.compound.delayed"].replace(
      "{months}",
      "12",
    );
    // 12 deposits of 100.00 at 1% a month: 1,280.93.
    expect(await result(delayed)).toContain("1,280.93");
    expect(await result(catalogEn["calc.compound.difference"])).not.toBe("");
  });

  it("finds the deposit for a target", async () => {
    await open("mode=target&target=123972&initial=0&months=12&rate=6.167781");
    expect(await result(catalogEn["calc.compound.depositNeeded"])).toContain(
      "100.00",
    );
  });

  it("shows no result while a required input is missing", async () => {
    await open("initial=100000&months=abc&rate=12");
    expect(
      await screen.findByText(catalogEn["calc.results.empty"]),
    ).toBeInTheDocument();
  });

  it("works without indexes", async () => {
    await open("initial=100000&months=12&rate=12");
    await result(catalogEn["calc.compound.final"]);
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

  // The amounts typed in the inputs stay readable to the person typing them (MoneyInput).
  it("states the monthly income the final amount pays after inflation", async () => {
    await open(
      "initial=100000&months=12&rate=12.682503&inflation=4&withdraw=10",
    );
    // 1,126.83 at 1% a month against 4% a year of inflation (0.3274% a month).
    expect(
      await result(catalogEn["calc.compound.income.lastingAtEnd"]),
    ).toContain("7.58");
    // The same income less a year of inflation: 7.58 / 1.04.
    expect(
      await result(catalogEn["calc.compound.income.lastingToday"]),
    ).toContain("7.29");
    // Spent over 10 years with an income that follows inflation.
    expect(
      await result(catalogEn["calc.compound.income.spendingToday"]),
    ).toContain("13.21");
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
    await result(catalogEn["calc.compound.final"]);
    expectNoAmounts(
      screen.getByRole("region", { name: catalogEn["calc.results"] }),
      ["1,126.83"],
    );
    expect(
      screen.getByRole("textbox", { name: catalogEn["calc.compound.rate"] }),
    ).toHaveValue("12.682503");
  });

  it("shows the range of outcomes only with a volatility", async () => {
    const { unmount } = await open(
      "initial=100000&deposit=10000&months=12&rate=12",
    );
    await result(catalogEn["calc.compound.final"]);
    expect(screen.queryByText(catalogEn["calc.compound.p10"])).toBeNull();
    unmount();
    await open("initial=100000&deposit=10000&months=12&rate=12&volatility=20");
    for (const key of [
      "calc.compound.p10",
      "calc.compound.p50",
      "calc.compound.p90",
    ] as const)
      expect(await result(catalogEn[key])).toMatch(/\d/);
  });
});
