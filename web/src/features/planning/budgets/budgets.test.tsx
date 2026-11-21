import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { money } from "@/testing/account-api";
import {
  budgetApi,
  foodBudget,
  fuelBudget,
  health,
} from "@/testing/budget-api";
import { json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

const november = "/planning?tab=budgets&view=track&month=2026-11";

function words(key: keyof typeof catalogEn, values: Record<string, string>) {
  return Object.entries(values).reduce<string>(
    (text, [k, v]) => text.replace(`{${k}}`, v),
    catalogEn[key],
  );
}

describe("PlanningPage budgets", () => {
  // Planning coherence A257: what a goal paid is outside the spending and named on the row.
  it("names what goals paid outside the budget", async () => {
    await renderApp(november, {
      fetch: budgetApi({
        [`GET /api/v1/budgets/${fuelBudget.id}/progress`]: () =>
          json(200, {
            month: "2026-11",
            planned: money(40000),
            carried: money(0),
            spent: money(10000),
            goal_paid: money(25000),
            available: money(30000),
          }),
      }),
    });

    const fuel = await screen.findByRole("row", { name: "Fuel" });

    expect(
      within(fuel).getByText(
        words("budget.restGoalPaid", {
          rest: words("budget.left", { amount: "R$300.00" }),
          paid: "R$250.00",
        }),
      ),
    ).toBeInTheDocument();
  });

  it("marks a budget spent to exactly its limit as reached", async () => {
    await renderApp(november, {
      fetch: budgetApi({
        [`GET /api/v1/budgets/${fuelBudget.id}/progress`]: () =>
          json(200, {
            month: "2026-11",
            planned: money(990),
            carried: money(0),
            spent: money(990),
            goal_paid: money(0),
            available: money(0),
          }),
      }),
    });

    const fuel = await screen.findByRole("row", { name: "Fuel" });

    expect(
      within(fuel).getByText(catalogEn["budget.reached"]),
    ).toBeInTheDocument();
    expect(
      within(fuel).queryByText(catalogEn["budget.near"]),
    ).not.toBeInTheDocument();
  });

  it("carries the month before into available (S60)", async () => {
    await renderApp("/planning?tab=budgets&view=track&month=2026-12", {
      fetch: budgetApi(),
    });
    const food = await screen.findByRole("row", { name: "Food" });
    expect(within(food).getByText("R$0.00")).toBeInTheDocument();
    expect(
      within(food).getByText(
        words("budget.ofPlanned", { planned: "R$2,000.00" }),
      ),
    ).toBeInTheDocument();
    expect(
      within(food).getByText(
        words("budget.restCarried", {
          rest: words("budget.left", { amount: "R$1,800.00" }),
          carried: "−R$200.00",
        }),
      ),
    ).toBeInTheDocument();
  });

  it("marks a budget whose spending passed planned plus carried", async () => {
    await renderApp(november, { fetch: budgetApi() });
    const food = await screen.findByRole("row", { name: "Food" });
    expect(
      within(food).getByText(catalogEn["budget.overspent"]),
    ).toBeInTheDocument();
    expect(
      within(food).getByText(
        words("budget.restCarried", {
          rest: words("budget.over", { amount: "R$200.00" }),
          carried: "R$300.00",
        }),
      ),
    ).toBeInTheDocument();
    expect(
      within(food).getByRole("progressbar", {
        name: words("budget.meter", { name: "Food" }),
      }),
    ).toHaveAttribute("aria-valuetext", catalogEn["budget.overspent"]);
    const fuel = screen.getByRole("row", { name: "Fuel" });
    expect(
      within(fuel).getByText(words("budget.left", { amount: "R$300.00" })),
    ).toBeInTheDocument();
    expect(
      within(fuel).getByRole("progressbar", {
        name: words("budget.meter", { name: "Fuel" }),
      }),
    ).toHaveAttribute("aria-valuenow", "25");
  });

  it("groups the budgets under their top category with a subtotal", async () => {
    await renderApp(november, { fetch: budgetApi() });
    await screen.findByRole("row", { name: "Food" });
    const rows = screen.getAllByRole("row");
    const transport = rows.findIndex((r) => within(r).queryByText("Transport"));
    expect(
      rows
        .slice(transport + 1, transport + 3)
        .map((row) => row.getAttribute("aria-label")),
    ).toEqual(["Fuel", "Parking"]);
    expect(
      within(rows[transport] ?? document.body).getByText(
        words("budget.groupTotal", { spent: "R$150.00", room: "R$500.00" }),
      ),
    ).toBeInTheDocument();
    // A budget that starts after the month has no line.
    expect(screen.queryByRole("row", { name: "Gifts" })).toBeNull();
  });

  it("sums the month over the budgets without counting a nested one twice", async () => {
    await renderApp(november, { fetch: budgetApi() });
    const summary = await screen.findByRole("region", {
      name: catalogEn["budget.summary"],
    });
    const spent = await within(summary).findByRole("group", {
      name: catalogEn["budget.figure.spent"],
    });
    expect(figureValue(spent)).toBe("R$2,450.00");
    expect(
      within(spent).getByText(
        words("budget.figure.share", { share: "94%", room: "R$2,600.00" }),
      ),
    ).toBeInTheDocument();
    const left = within(summary).getByRole("group", {
      name: catalogEn["budget.figure.left"],
    });
    expect(figureValue(left)).toBe("R$150.00");
    expect(
      within(left).getByText(catalogEn["budget.figure.monthAhead"]),
    ).toBeInTheDocument();
    const overspent = within(summary).getByRole("group", {
      name: catalogEn["budget.figure.overspent"],
    });
    expect(figureValue(overspent)).toBe("1");
    expect(
      within(overspent).getByText(
        [
          words("budget.nearMany", { count: "0" }),
          words("budget.withinMany", { count: "2" }),
        ].join(" · "),
      ),
    ).toBeInTheDocument();
  });

  it("lists the spending of categories no budget covers, each with a way to budget it", async () => {
    await renderApp(november, { fetch: budgetApi() });
    // The block stays closed until asked for; its trigger carries the total.
    await userEvent.click(
      await screen.findByRole("button", {
        name: words("budget.groupLine", {
          name: catalogEn["budget.unbudgeted"],
          amount: "R$120.00",
        }),
      }),
    );
    const list = await screen.findByRole("list", {
      name: catalogEn["budget.unbudgeted"],
    });
    const items = await within(list).findAllByRole("listitem");
    expect(items).toHaveLength(1);
    const [item] = items;
    if (item === undefined) throw new Error("no item");
    expect(within(item).getByText("Health")).toBeInTheDocument();
    expect(within(item).getByText("R$120.00")).toBeInTheDocument();
    expect(
      within(item).getByRole("link", {
        name: words("budget.createFor", { name: "Health" }),
      }),
    ).toHaveAttribute("href", `/planning/budgets/new?category=${health.id}`);
  });

  it("shows the committed amounts and the price that valued another currency (S66)", async () => {
    await renderApp(november, { fetch: budgetApi() });
    const summary = await screen.findByRole("region", {
      name: catalogEn["budget.summary"],
    });
    const committed = await within(summary).findByRole("group", {
      name: catalogEn["budget.figure.committed"],
    });
    await waitFor(() => {
      expect(figureValue(committed)).toBe("R$388.27");
    });
    expect(
      within(committed).getByText(
        words("budget.figure.committedParts", {
          installments: "R$333.33",
          expected: "R$54.94",
        }),
      ),
    ).toBeInTheDocument();
    expect(
      within(committed).getByText(
        words("budget.price", {
          instrument: "USD",
          rate: "5.5000",
          quote: "BRL",
          date: "10/30/2026",
        }),
      ),
    ).toBeInTheDocument();
  });

  it("changes a budget's amount from its line", async () => {
    const sent: unknown[] = [];
    await renderApp(november, {
      fetch: budgetApi({
        [`POST /api/v1/budgets/${foodBudget.id}/amounts`]: async (req) => {
          sent.push(await req.json());
          return json(201, foodBudget);
        },
      }),
    });
    const food = await screen.findByRole("row", { name: "Food" });
    await userEvent.click(
      within(food).getByRole("button", {
        name: words("budget.actions", { name: "Food" }),
      }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", {
        name: catalogEn["budget.changeAmount"],
      }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: catalogEn["budget.amount"] }),
      "250000",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["budget.save"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual([
        { effective_from: "2027-01", amount: money(250000) },
      ]);
    });
  });

  it("deletes a budget from its line after a confirmation (S144)", async () => {
    const deleted: string[] = [];
    await renderApp(november, {
      fetch: budgetApi({
        [`DELETE /api/v1/budgets/${foodBudget.id}`]: () => {
          deleted.push(foodBudget.id);
          return new Response(null, { status: 204 });
        },
      }),
    });
    const food = await screen.findByRole("row", { name: "Food" });
    await userEvent.click(
      within(food).getByRole("button", {
        name: words("budget.actions", { name: "Food" }),
      }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: catalogEn["budget.delete"] }),
    );
    const dialog = await screen.findByRole("alertdialog", {
      name: words("budget.deleteTitle", { name: "Food" }),
    });
    expect(deleted).toEqual([]);
    await userEvent.click(
      within(dialog).getByRole("button", { name: catalogEn["budget.delete"] }),
    );
    await waitFor(() => {
      expect(deleted).toEqual([foodBudget.id]);
    });
  });
});

// The value a figure of the month strip shows, symbol and minor digits included.
function figureValue(figure: HTMLElement) {
  return figure.querySelector("[data-figure=value]")?.textContent;
}
