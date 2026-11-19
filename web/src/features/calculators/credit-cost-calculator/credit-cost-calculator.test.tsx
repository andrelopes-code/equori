import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { calculatorApiRoutes } from "@/testing/calculator-api";
import { fakeApi, json } from "@/testing/fake-api";
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

// The widths of the bar row's parts, as numbers.
async function parts(): Promise<number[]> {
  const row = await screen.findByRole("img");
  return Array.from(row.children[1]?.children ?? []).map((part) =>
    parseFloat((part as HTMLElement).style.inlineSize),
  );
}

const offer =
  "released=1000000&fees=20000&installment=88849&count=12&releaseDate=2026-01-10&firstDue=2026-02-10";
const withoutFees =
  "released=1000000&installment=88849&count=12&releaseDate=2026-01-10&firstDue=2026-02-10";

const open = (region?: string, search = offer) =>
  renderApp(`/calculators/credit-cost?${search}`, {
    fetch: fakeApi({
      ...calculatorApiRoutes(),
      ...(region === undefined
        ? {}
        : {
            "GET /api/v1/me": () =>
              json(200, {
                id: 1,
                email: "a@b.c",
                role: "admin",
                language: "en",
                region,
              }),
          }),
    }),
  });

describe("Cost of credit calculator", () => {
  // The profile's region is kept in the browser between renders.
  afterEach(() => {
    localStorage.removeItem("equori.locale");
  });

  it("computes the effective annual cost with 2 decimals", async () => {
    await open();
    expect(await figure(catalogEn["calc.credit.annual"])).toBe("17.14%");
  });

  it("states the offer in the sentence and the monthly rate, total paid and amount released", async () => {
    await open();
    expect(
      await screen.findByText(
        /^on .*10,000\.00 released in 12 installments of .*888\.49\.$/,
      ),
    ).toBeInTheDocument();
    expect(await result(catalogEn["calc.credit.monthly"])).toBe("1.3271%");
    expect(await result(catalogEn["calc.credit.paid"])).toContain("10,861.88");
    expect(await result(catalogEn["calc.credit.released"])).toContain(
      "10,000.00",
    );
  });

  it("splits the total paid into the amount released and the cost in one bar", async () => {
    await open();
    const [released, cost] = await parts();
    // 1,000,000 released and 86,188 of cost, on an axis of 1,200,000.
    expect(released).toBeCloseTo(83.3333, 3);
    expect(cost).toBeCloseTo(7.1823, 3);
    // 10,861.88 paid: 10,000.00 released and 861.88 of cost.
    expect(screen.getByRole("img").getAttribute("aria-label")).toMatch(
      /^Total paid .*10,861\.88: Amount released .*10,000\.00, Cost .*861\.88$/,
    );
    expect(
      screen
        .getByRole("img")
        .parentElement?.querySelector('p[data-part="legend"]')?.textContent,
    ).toBe("Amount releasedCost");
  });

  it("keeps the flows in details, closed until opened", async () => {
    await open();
    await figure(catalogEn["calc.credit.annual"]);
    const trigger = screen.getByRole("button", {
      name: new RegExp(catalogEn["calc.credit.details"]),
    });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await userEvent.setup().click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const table = await screen.findByRole("table", {
      name: catalogEn["calc.credit.flows"],
    });
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(13);
    // 2026-02-10 is 31 days after 2026-01-10.
    expect(rows[1]?.textContent).toContain("31");
  });

  it("names the number of flows beside the details", async () => {
    await open();
    expect(await screen.findByText("12 flows")).toBeInTheDocument();
  });

  it("opens the fees group from the address and clears it on removal", async () => {
    const user = userEvent.setup();
    await open();
    const field = await screen.findByRole("textbox", {
      name: catalogEn["calc.credit.fees"],
    });
    expect(field).toHaveValue("200.00");
    await user.click(
      screen.getByRole("button", {
        name: catalogEn["calc.credit.fees.remove"],
      }),
    );
    expect(
      await screen.findByRole("button", {
        name: catalogEn["calc.credit.fees.add"],
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: catalogEn["calc.credit.fees"] }),
    ).toBeNull();
    // 12 installments of 88,849 with no fees.
    expect(await result(catalogEn["calc.credit.paid"])).toContain("10,661.88");
  });

  it("keeps the fees group closed without fees in the address", async () => {
    await open(undefined, withoutFees);
    await figure(catalogEn["calc.credit.annual"]);
    expect(
      screen.getByRole("button", { name: catalogEn["calc.credit.fees.add"] }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", { name: catalogEn["calc.credit.fees"] }),
    ).toBeNull();
  });

  it("names every missing input while the answer is empty", async () => {
    await open(undefined, "");
    expect(
      await screen.findByText(
        /^Fill in amount released, number of installments, installment, and first due date to see the effective cost\.$/,
      ),
    ).toBeInTheDocument();
    expect(await figure(catalogEn["calc.credit.annual"])).toBe("—");
  });

  it("states in the sentence that the first due date must follow the release", async () => {
    await open(
      undefined,
      "released=1000000&installment=88849&count=12&releaseDate=2026-01-10&firstDue=2026-01-10",
    );
    expect(
      await screen.findByText(catalogEn["calc.credit.order"]),
    ).toBeInTheDocument();
    expect(await figure(catalogEn["calc.credit.annual"])).toBe("—");
  });

  it("states in the sentence when no annual cost fits the flows", async () => {
    await open(
      undefined,
      "released=1000000&installment=1&count=1&releaseDate=2026-01-10&firstDue=2026-02-10",
    );
    expect(
      await screen.findByText(catalogEn["calc.credit.noSolution"]),
    ).toBeInTheDocument();
    expect(await figure(catalogEn["calc.credit.annual"])).toBe("—");
  });

  it("states the APR of a United States contract beside the effective cost", async () => {
    const { unmount } = await open("BR");
    await figure(catalogEn["calc.credit.annual"]);
    expect(screen.queryByText(catalogEn["calc.credit.us.apr"])).toBeNull();
    unmount();
    await open("US");
    // 17.14% a year is 1.3271% a month, times 12.
    expect(await result(catalogEn["calc.credit.us.apr"])).toBe("15.92%");
  });

  it("names the CET only for Brazil", async () => {
    const { unmount } = await open();
    await figure(catalogEn["calc.credit.annual"]);
    expect(screen.queryByText(catalogEn["calc.credit.cet"])).toBeNull();
    unmount();
    await open("BR");
    await figure(catalogEn["calc.credit.annual"]);
    await userEvent
      .setup()
      .click(
        screen.getByRole("button", { name: catalogEn["calc.method.open"] }),
      );
    expect(
      await screen.findByText(catalogEn["calc.credit.cet"]),
    ).toBeInTheDocument();
  });
});
