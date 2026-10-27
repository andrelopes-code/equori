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
    expect(await result(catalogEn["calc.recurring.total"])).toContain("600.00");
    expect(await result(catalogEn["calc.recurring.futureValue"])).toContain(
      "600.00",
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
    expect(await result(catalogEn["calc.recurring.total"])).toContain(
      "25,200.00",
    );
  });
});
