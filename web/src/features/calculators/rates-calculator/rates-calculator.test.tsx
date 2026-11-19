import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { calculatorApiRoutes, cdiFixture } from "@/testing/calculator-api";
import { fakeApi, json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

// A fact of the answer: the value beside its term.
async function result(label: string): Promise<string> {
  const term = await screen.findByText(label, { selector: "dt" });
  return term.parentElement?.querySelector("dd")?.textContent ?? "";
}

const open = (
  search: string,
  routes = calculatorApiRoutes(),
  region?: string,
) =>
  renderApp(`/calculators/rates?${search}`, {
    fetch: fakeApi({
      ...routes,
      ...(region === undefined
        ? {}
        : {
            "GET /api/v1/me": () =>
              json(200, {
                id: 1,
                email: "a@b.c",
                role: "admin",
                language: "pt",
                region,
              }),
          }),
    }),
  });

describe("Rate converter", () => {
  // The profile's region is kept in the browser between renders.
  afterEach(() => {
    localStorage.removeItem("equori.locale");
  });

  it("converts a monthly rate to an annual one (M5)", async () => {
    await open("rate=1&period=month");
    expect(
      await screen.findByText("12.6825%", { selector: "p" }),
    ).toBeVisible();
    expect(
      screen.getByText(catalogEn["calc.rates.answer.leadYear"]),
    ).toBeVisible();
    expect(
      screen.getByText("1% a month equals 12.6825% a year."),
    ).toBeVisible();
  });

  it("converts an annual rate to a monthly one (M5)", async () => {
    await open("rate=12.6825&period=year");
    expect(await screen.findByText("1%", { selector: "p" })).toBeVisible();
    expect(
      screen.getByText(catalogEn["calc.rates.answer.leadMonth"]),
    ).toBeVisible();
    expect(
      screen.getByText("12.6825% a year equals 1% a month."),
    ).toBeVisible();
  });

  it("names the missing rate in the sentence and shows no figure", async () => {
    await open("");
    expect(
      await screen.findByText("Fill in rate to see the equivalent rate."),
    ).toBeVisible();
    expect(screen.getByText("—", { selector: "p" })).toBeVisible();
  });

  it("shows no fact whose input is not set", async () => {
    await open("rate=1&period=month");
    await screen.findByText("12.6825%", { selector: "p" });
    expect(
      screen.queryByText(catalogEn["calc.rates.real"], { selector: "dt" }),
    ).toBeNull();
    expect(
      screen.queryByText(catalogEn["calc.rates.ofIndex"], { selector: "dt" }),
    ).toBeNull();
  });

  it("shows a rate from the address with the comma of pt-BR", async () => {
    await open("rate=11.5&period=month", calculatorApiRoutes(), "BR");
    expect(await screen.findByText(/^11,5% ao mês equivale a /)).toBeVisible();
    expect(screen.getByDisplayValue("11,5")).toBeVisible();
  });

  it("keeps both optional groups closed until chosen", async () => {
    await open("rate=1&period=month", calculatorApiRoutes([cdiFixture()]));
    expect(
      await screen.findByRole("button", {
        name: catalogEn["calc.rates.inflation.add"],
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: catalogEn["calc.rates.index.add"] }),
    ).toBeVisible();
    expect(
      screen.queryByLabelText(catalogEn["calc.rates.inflation"]),
    ).toBeNull();
  });

  it("opens the inflation group by its key and clears it on removal", async () => {
    const { router } = await open("rate=10&period=year&inflation=4");
    await userEvent.click(
      await screen.findByRole("button", {
        name: catalogEn["calc.rates.inflation.remove"],
      }),
    );
    expect(
      await screen.findByRole("button", {
        name: catalogEn["calc.rates.inflation.add"],
      }),
    ).toBeVisible();
    expect(router.state.location.search).not.toHaveProperty("inflation");
  });

  it("clears the five keys of the index group on removal", async () => {
    const { router } = await open(
      "percent=abc&spread=2&form=spread&basis=current&index=cdi",
      calculatorApiRoutes([cdiFixture()]),
    );
    await userEvent.click(
      await screen.findByRole("button", {
        name: catalogEn["calc.rates.index.remove"],
      }),
    );
    expect(
      await screen.findByRole("button", {
        name: catalogEn["calc.rates.index.add"],
      }),
    ).toBeVisible();
    for (const key of ["index", "form", "percent", "spread", "basis"])
      expect(router.state.location.search).not.toHaveProperty(key);
  });

  it("discounts inflation from an annual rate (M6)", async () => {
    await open("rate=10&period=year&inflation=4");
    expect(await result(catalogEn["calc.rates.real"])).toBe("5.7692%");
  });

  it("gives the annual rate of a percent of a daily index", async () => {
    await open("percent=110&index=cdi", calculatorApiRoutes([cdiFixture()]));
    // 261 days at 110% of 0.04%: 1.00044^261 − 1.
    expect(await result(catalogEn["calc.rates.ofIndex"])).toBe("12.1666%");
  });

  it("takes the last rate of a daily index over a year, or its trailing 12 months", async () => {
    const cdi = cdiFixture();
    cdi.rates[cdi.rates.length - 1] = { date: "2026-10-16", rate: "0.0005" };
    // Design §4, "Index basis": 1.0005^261 − 1 by default.
    await open("percent=100&index=cdi", calculatorApiRoutes([cdi]));
    expect(await result(catalogEn["calc.rates.ofIndex"])).toBe("13.9361%");
  });

  it("takes the trailing 12 months of a daily index when chosen", async () => {
    const cdi = cdiFixture();
    cdi.rates[cdi.rates.length - 1] = { date: "2026-10-16", rate: "0.0005" };
    // 1.0004^260 × 1.0005 − 1.
    await open(
      "percent=100&index=cdi&basis=trailing",
      calculatorApiRoutes([cdi]),
    );
    expect(await result(catalogEn["calc.rates.ofIndex"])).toBe("11.0132%");
  });

  it("follows the path the market expects when the index has one (ADR 026 E9)", async () => {
    const cdi = {
      ...cdiFixture(),
      // From the day after the last rate the path stays at 10% a year.
      expectations: {
        survey_date: "2026-10-16",
        items: [{ date: "2026-10-17", rate: "0.1" }],
      },
    };
    await open("percent=100&index=cdi", calculatorApiRoutes([cdi]));
    expect(await result(catalogEn["calc.rates.ofIndex"])).toBe("10%");
  });

  it("keeps the current rate when chosen over the expected path", async () => {
    const cdi = {
      ...cdiFixture(),
      expectations: {
        survey_date: "2026-10-16",
        items: [{ date: "2026-10-17", rate: "0.1" }],
      },
    };
    await open(
      "percent=110&index=cdi&basis=current",
      calculatorApiRoutes([cdi]),
    );
    expect(await result(catalogEn["calc.rates.ofIndex"])).toBe("12.1666%");
  });

  it("gives the annual rate of a daily index plus a spread", async () => {
    await open("spread=2&index=cdi", calculatorApiRoutes([cdiFixture()]));
    // 1.0004^261 × 1.02 − 1: a spread compounds with an index of business days.
    expect(await result(catalogEn["calc.rates.ofIndex"])).toBe("13.2222%");
  });
});
