import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { calculatorApiRoutes, cdiFixture } from "@/testing/calculator-api";
import { fakeApi } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

async function result(label: string): Promise<string> {
  const term = await screen.findByText(label, { selector: "dt" });
  return term.parentElement?.querySelector("dd")?.textContent ?? "";
}

const open = (search: string, routes = calculatorApiRoutes()) =>
  renderApp(`/calculators/rates?${search}`, { fetch: fakeApi(routes) });

describe("Rate converter", () => {
  it("converts a monthly rate to an annual one (M5)", async () => {
    await open("rate=1&period=month");
    expect(await result(catalogEn["calc.rates.annual"])).toBe("12.6825%");
    expect(await result(catalogEn["calc.rates.monthly"])).toBe("1%");
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

  it("gives the annual rate of a daily index plus a spread", async () => {
    await open("spread=2&index=cdi", calculatorApiRoutes([cdiFixture()]));
    // 1.0004^261 × 1.02 − 1: a spread compounds with an index of business days.
    expect(await result(catalogEn["calc.rates.ofIndex"])).toBe("13.2222%");
  });
});
