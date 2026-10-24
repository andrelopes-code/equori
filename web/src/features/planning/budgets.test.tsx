import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { money } from "@/testing/account-api";
import { budgetApi, foodBudget, health } from "@/testing/budget-api";
import { json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

const november = "/planning?tab=budgets&month=2026-11";

function words(key: keyof typeof catalogEn, values: Record<string, string>) {
  return Object.entries(values).reduce<string>(
    (text, [k, v]) => text.replace(`{${k}}`, v),
    catalogEn[key],
  );
}

describe("PlanningPage budgets", () => {
  it("carries the month before into available (S60)", async () => {
    await renderApp("/planning?tab=budgets&month=2026-12", {
      fetch: budgetApi(),
    });
    const food = await screen.findByRole("article", { name: "Food" });
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
    const food = await screen.findByRole("article", { name: "Food" });
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
    const fuel = screen.getByRole("article", { name: "Fuel" });
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
    const transport = await screen.findByRole("region", { name: "Transport" });
    expect(
      within(transport)
        .getAllByRole("article")
        .map((card) => card.getAttribute("aria-label")),
    ).toEqual(["Fuel", "Parking"]);
    expect(
      within(transport).getByText(
        words("budget.groupTotal", { spent: "R$150.00", room: "R$500.00" }),
      ),
    ).toBeInTheDocument();
    // A budget that starts after the month has no card.
    expect(screen.queryByRole("article", { name: "Gifts" })).toBeNull();
  });

  it("sums the month over the budgets without counting a nested one twice", async () => {
    await renderApp(november, { fetch: budgetApi() });
    const summary = await screen.findByRole("region", {
      name: catalogEn["budget.summary"],
    });
    expect(
      await within(summary).findByText(
        words("budget.ofRoom", { room: "R$2,600.00" }),
      ),
    ).toBeInTheDocument();
    expect(within(summary).getByText("R$2,450.00")).toBeInTheDocument();
    expect(
      within(summary).getByText(
        words("budget.states", { over: "1", near: "0", within: "2" }),
      ),
    ).toBeInTheDocument();
  });

  it("lists the spending of categories no budget covers, each with a way to budget it", async () => {
    await renderApp(november, { fetch: budgetApi() });
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
    expect(await within(summary).findByText("R$388.27")).toBeInTheDocument();
    expect(
      within(summary).getByText(
        words("budget.committedParts", {
          installments: "R$333.33",
          occurrences: "R$54.94",
        }),
      ),
    ).toBeInTheDocument();
    expect(
      within(summary).getByText(
        words("budget.price", {
          instrument: "USD",
          rate: "5.5000",
          quote: "BRL",
          date: "10/30/2026",
        }),
      ),
    ).toBeInTheDocument();
  });

  it("changes a budget's amount from its card", async () => {
    const sent: unknown[] = [];
    await renderApp(november, {
      fetch: budgetApi({
        [`POST /api/v1/budgets/${foodBudget.id}/amounts`]: async (req) => {
          sent.push(await req.json());
          return json(201, foodBudget);
        },
      }),
    });
    const food = await screen.findByRole("article", { name: "Food" });
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

  it("puts the budgets before the chart on a phone, as rows of one surface", async () => {
    const { container } = await renderApp(november, {
      fetch: budgetApi(),
      width: 390,
    });
    const transport = await screen.findByRole("region", { name: "Transport" });
    expect(transport.querySelector('[data-ui="card"]')).toBeNull();
    const chart = container.querySelector('[data-ui="chart"]');
    if (chart === null) throw new Error("no chart");
    expect(
      transport.compareDocumentPosition(chart) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.queryByText(
        words("budget.states", { over: "1", near: "0", within: "2" }),
      ),
    ).toBeNull();
  });
});
