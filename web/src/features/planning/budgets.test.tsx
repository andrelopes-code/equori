import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { budgetApi } from "@/testing/budget-api";
import { renderApp } from "@/testing/render-app";

const november = "/planning?tab=budgets&month=2026-11";

function cells(row: HTMLElement) {
  return within(row)
    .getAllByRole("cell")
    .map((cell) => cell.textContent);
}

describe("PlanningPage budgets", () => {
  it("carries the month before into available (S60)", async () => {
    await renderApp("/planning?tab=budgets&month=2026-12", {
      fetch: budgetApi(),
    });
    const row = await screen.findByRole("row", { name: /^Food/ });
    expect(cells(row).slice(0, 4)).toEqual([
      "R$2,000.00",
      "−R$200.00",
      "R$0.00",
      "R$1,800.00",
    ]);
  });

  it("marks a budget whose spending passed planned plus carried", async () => {
    await renderApp(november, { fetch: budgetApi() });
    const food = await screen.findByRole("row", { name: /^Food/ });
    expect(cells(food).slice(0, 4)).toEqual([
      "R$1,800.00",
      "R$300.00",
      "R$2,300.00",
      "−R$200.00",
    ]);
    expect(
      within(food).getByRole("progressbar", {
        name: catalogEn["budget.meter"].replace("{name}", "Food"),
      }),
    ).toHaveAttribute("aria-valuetext", catalogEn["budget.overspent"]);
    const fuel = screen.getByRole("row", { name: /^Fuel/ });
    expect(
      within(fuel).getByRole("progressbar", {
        name: catalogEn["budget.meter"].replace("{name}", "Fuel"),
      }),
    ).toHaveAttribute("aria-valuenow", "25");
  });

  it("groups the budgets under their top category with a subtotal", async () => {
    await renderApp(november, { fetch: budgetApi() });
    await screen.findByRole("row", { name: /^Fuel/ });
    const table = screen.getByRole("table", {
      name: catalogEn["budget.caption"],
    });
    const headers = within(table)
      .getAllByRole("rowheader")
      .map((cell) => cell.textContent);
    expect(headers).toEqual([
      "Food",
      "Transport",
      "Fuel",
      "Parking",
      catalogEn["budget.subtotal"].replace("{name}", "Transport"),
    ]);
    const subtotal = screen.getByRole("row", {
      name: new RegExp(
        `^${catalogEn["budget.subtotal"].replace("{name}", "Transport")}`,
      ),
    });
    expect(cells(subtotal).slice(0, 4)).toEqual([
      "R$500.00",
      "R$0.00",
      "R$150.00",
      "R$350.00",
    ]);
    // A budget that starts after the month has no row.
    expect(screen.queryByRole("row", { name: /^Gifts/ })).toBeNull();
  });

  it("lists the spending of categories no budget covers", async () => {
    await renderApp(november, { fetch: budgetApi() });
    const table = await screen.findByRole("table", {
      name: catalogEn["budget.unbudgeted"],
    });
    await within(table).findByRole("rowheader", { name: "Health" });
    const rows = within(table).getAllByRole("row");
    expect(rows.slice(1).map((row) => row.textContent)).toEqual([
      "HealthR$120.00",
    ]);
  });

  it("shows the committed amounts and the price that valued another currency (S66)", async () => {
    await renderApp(november, { fetch: budgetApi() });
    const figures = await screen.findByRole("region", {
      name: catalogEn["budget.committed"],
    });
    expect(await within(figures).findByText("R$388.27")).toBeInTheDocument();
    expect(within(figures).getByText("R$333.33")).toBeInTheDocument();
    expect(within(figures).getByText("R$54.94")).toBeInTheDocument();
    expect(
      within(figures).getByText(
        catalogEn["budget.price"]
          .replace("{instrument}", "USD")
          .replace("{rate}", "5.5000")
          .replace("{quote}", "BRL")
          .replace("{date}", "10/30/2026"),
      ),
    ).toBeInTheDocument();
  });
});
