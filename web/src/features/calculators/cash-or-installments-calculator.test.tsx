import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  renderApp(`/calculators/cash-or-installments?${search}`, {
    fetch: fakeApi(routes),
  });

describe("Cash or installments calculator", () => {
  it("states the implied rate and the present value of the installments", async () => {
    await open(
      "cash=100000&count=10&installment=11000&compare=1&comparePeriod=month",
    );
    expect(await result(catalogEn["calc.cash.monthly"])).toBe("1.7715%");
    expect(await result(catalogEn["calc.cash.annual"])).toBe("23.4572%");
    expect(await result(catalogEn["calc.cash.presentValue"])).toContain(
      "1,041.84",
    );
    expect(await result(catalogEn["calc.cash.cashLower"])).toContain("41.84");
  });

  it("states that installments at or below the cash price carry no interest", async () => {
    await open("cash=100000&count=10&installment=10000");
    expect(
      await screen.findByText(catalogEn["calc.cash.noInterest"]),
    ).toBeInTheDocument();
  });

  it("takes the comparison rate from a percent of a daily index", async () => {
    const user = userEvent.setup();
    await open(
      "cash=100000&count=10&installment=11000",
      calculatorApiRoutes([cdiFixture()]),
    );
    await user.click(
      await screen.findByRole("combobox", {
        name: catalogEn["calc.cash.rateSource"],
      }),
    );
    await user.click(await screen.findByRole("option", { name: "CDI" }));
    const rate = await screen.findByRole("textbox", {
      name: catalogEn["calc.cash.compare"],
    });
    await waitFor(() => {
      expect(rate).toHaveValue("11.0021");
    });
    const field = rate.closest<HTMLElement>('[data-ui="field"]');
    if (field === null) throw new Error("the rate stands in no field");
    expect(within(field).getByText(/^From your data:/)).toBeInTheDocument();
  });
});
