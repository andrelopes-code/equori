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

  it("gives the annual rate of a daily index plus a spread", async () => {
    await open("spread=2&index=cdi", calculatorApiRoutes([cdiFixture()]));
    // 1.0004^261 × 1.02 − 1: a spread compounds with an index of business days.
    expect(await result(catalogEn["calc.rates.ofIndex"])).toBe("13.2222%");
  });
});
