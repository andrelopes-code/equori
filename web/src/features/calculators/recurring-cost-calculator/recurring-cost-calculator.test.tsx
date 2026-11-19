import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { calculatorApiRoutes } from "@/testing/calculator-api";
import { fakeApi, json } from "@/testing/fake-api";
import { schedules } from "@/testing/planning-api";
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

const lead = (years: number) =>
  catalogEn["calc.recurring.answer.lead"].replace("{years}", String(years));

const open = (search: string) =>
  renderApp(`/calculators/recurring-cost?${search}`, {
    fetch: fakeApi({
      ...calculatorApiRoutes(),
      "GET /api/v1/schedules": () => json(200, { items: schedules }),
    }),
  });

describe("Recurring cost calculator", () => {
  it("adds the payments and grows them at a rate", async () => {
    await open("amount=5000&years=1&rate=0");
    // 12 payments of 50.00.
    expect(await figure(lead(1))).toContain("600.00");
    expect(await result(catalogEn["calc.recurring.futureValue"])).toContain(
      "600.00",
    );
    expect(await result(catalogEn["calc.recurring.difference"])).toContain(
      "0.00",
    );
  });

  it("fills the amount from a schedule", async () => {
    const user = userEvent.setup();
    await open("years=1");
    await user.click(
      await screen.findByRole("combobox", {
        name: catalogEn["calc.recurring.schedule"],
      }),
    );
    await user.click(await screen.findByRole("option", { name: "Rent" }));
    const field = (
      await screen.findByText(/^From your data:/)
    ).closest<HTMLElement>('[data-ui="field"]');
    if (field === null) throw new Error("the note stands in no field");
    expect(
      within(field).getByText(catalogEn["calc.recurring.amount"]),
    ).toBeInTheDocument();
    // Rent is 2,100.00 a month: 25,200.00 in a year.
    expect(await figure(lead(1))).toContain("25,200.00");
  });

  it("opens filled from the address and states the payments in the sentence", async () => {
    await open("amount=5000&years=3");
    expect(await figure(lead(3))).toContain("1,800.00");
    expect(
      await screen.findByText(/^.*50\.00 per month, without interest\.$/),
    ).toBeInTheDocument();
  });

  it("names the missing inputs while the answer is empty", async () => {
    await open("");
    expect(
      await screen.findByText(
        "Fill in amount per occurrence and years to see the total paid.",
      ),
    ).toBeInTheDocument();
  });

  it("keeps the rate group closed until it is added, with no facts and no bars", async () => {
    await open("amount=5000&years=1");
    await figure(lead(1));
    expect(
      screen.getByRole("button", {
        name: catalogEn["calc.recurring.rate.add"],
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(catalogEn["calc.recurring.futureValue"], {
        selector: "dt",
      }),
    ).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("states the rate in the sentence and the future value and difference as facts", async () => {
    await open("amount=100000&per=year&years=2&rate=10");
    // Two deposits at the start of each year at 10%: 100,000 * 1.1^2 + 100,000 * 1.1 = 2,310.00
    // from 2,000.00 paid, 310.00 of difference.
    expect(await figure(lead(2))).toContain("2,000.00");
    expect(await result(catalogEn["calc.recurring.futureValue"])).toContain(
      "2,310.00",
    );
    expect(await result(catalogEn["calc.recurring.difference"])).toContain(
      "310.00",
    );
    expect(
      await screen.findByText(
        /^.*1,000\.00 per year; invested at 10% a year, it would become .*2,310\.00\.$/,
      ),
    ).toBeInTheDocument();
  });

  it("draws the total paid and the future value as two single-part bars", async () => {
    await open("amount=100000&per=year&years=2&rate=10");
    const [paid, future] = await rows();
    // 231,000 has 6 digits: the axis steps by 20,000 and rounds up to 240,000.
    // 200,000 paid is 83.3333% of it and 231,000 reached is 96.25%.
    expect(paid).toHaveLength(1);
    expect(future).toHaveLength(1);
    expect(paid?.[0]).toBeCloseTo(83.3333, 3);
    expect(future?.[0]).toBeCloseTo(96.25, 3);
    expect(screen.getAllByRole("img")[0]?.getAttribute("aria-label")).toMatch(
      /^Total paid .*2,000\.00$/,
    );
  });

  it("opens the rate group from the address and drops the facts and bars on removal", async () => {
    const user = userEvent.setup();
    await open("amount=5000&years=1&rate=5");
    expect(
      await screen.findByRole("textbox", {
        name: catalogEn["calc.recurring.rate"],
      }),
    ).toHaveValue("5");
    await user.click(
      screen.getByRole("button", {
        name: catalogEn["calc.recurring.rate.remove"],
      }),
    );
    expect(
      await screen.findByRole("button", {
        name: catalogEn["calc.recurring.rate.add"],
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(catalogEn["calc.recurring.futureValue"], {
        selector: "dt",
      }),
    ).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
    expect(await figure(lead(1))).toContain("600.00");
  });
});
