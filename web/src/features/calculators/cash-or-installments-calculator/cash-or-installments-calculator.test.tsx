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

// The figure of the answer, after the lead the screen states.
async function figure(lead: string): Promise<string> {
  const node = await screen.findByText(lead);
  return node.nextElementSibling?.textContent ?? "";
}

// The widths of the bar rows' first parts.
async function bars(): Promise<string[]> {
  const rows = await screen.findAllByRole("img");
  return rows.map(
    (row) => (row.children[1]?.children[0] as HTMLElement).style.inlineSize,
  );
}

const open = (search: string, routes = calculatorApiRoutes()) =>
  renderApp(`/calculators/cash-or-installments?${search}`, {
    fetch: fakeApi(routes),
  });

const compared =
  "cash=100000&count=10&installment=11000&compare=1&comparePeriod=month";

describe("Cash or installments calculator", () => {
  it("opens filled from the address and states which option costs less", async () => {
    await open(compared);
    expect(await figure(catalogEn["calc.cash.answer.leadCash"])).toContain(
      "41.84",
    );
    expect(
      screen.getByText(/at present value at 1(\.0+)?% a month/),
    ).toBeInTheDocument();
  });

  it("states the implied rates and the present value of the installments", async () => {
    await open(compared);
    expect(await result(catalogEn["calc.cash.monthly"])).toBe("1.7715%");
    expect(await result(catalogEn["calc.cash.annual"])).toBe("23.4572%");
    expect(await result(catalogEn["calc.cash.presentValue"])).toContain(
      "1,041.84",
    );
  });

  it("draws the cash price and the present value on one axis", async () => {
    await open(compared);
    const [cash, present] = await bars();
    expect(parseFloat(cash ?? "")).toBeLessThan(parseFloat(present ?? ""));
  });

  it("leads with the installments when their present value is lower", async () => {
    await open(
      "cash=100000&count=10&installment=10100&compare=5&comparePeriod=month",
    );
    expect(
      await figure(catalogEn["calc.cash.answer.leadInstallments"]),
    ).toContain("220.10");
  });

  it("states that the options cost the same", async () => {
    await open(
      "cash=100000&count=1&installment=100000&first=now&compare=2&comparePeriod=month",
    );
    expect(await figure(catalogEn["calc.cash.answer.leadEqual"])).toMatch(
      /0\.00/,
    );
    expect(
      await screen.findByText(catalogEn["calc.cash.noInterest"]),
    ).toBeInTheDocument();
  });

  it("states in the answer that installments at or below the cash price carry no interest", async () => {
    await open("cash=100000&count=10&installment=10000");
    expect(
      await screen.findByText(catalogEn["calc.cash.noInterest"]),
    ).toBeInTheDocument();
    expect(await figure(catalogEn["calc.cash.answer.lead"])).toBe("—");
  });

  it("states in the answer that no rate makes the installments equal the cash price", async () => {
    await open("cash=100000&count=2&installment=10000000");
    expect(
      await screen.findByText(catalogEn["calc.cash.noSolution"]),
    ).toBeInTheDocument();
  });

  it("asks for the comparison rate and keeps the implied rates reachable", async () => {
    await open("cash=100000&count=10&installment=11000");
    expect(
      await screen.findByText(/^Fill in comparison rate to see/),
    ).toBeInTheDocument();
    expect(await result(catalogEn["calc.cash.monthly"])).toBe("1.7715%");
  });

  it("names every missing input before the answer", async () => {
    await open("");
    expect(
      await screen.findByText(
        /^Fill in cash price, number of installments, installment, and comparison rate to see/i,
      ),
    ).toBeInTheDocument();
  });

  it("takes the comparison rate from a percent of a daily index", async () => {
    const user = userEvent.setup();
    await open(
      "cash=100000&count=10&installment=11000",
      calculatorApiRoutes([cdiFixture()]),
    );
    const source = await screen.findByRole("radiogroup", {
      name: catalogEn["calc.cash.rateSource"],
    });
    await user.click(within(source).getByRole("radio", { name: "CDI" }));
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
