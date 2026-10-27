import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { budgetPlan, budgetPlanApi, energy } from "@/testing/budget-plan-api";
import { money } from "@/testing/account-api";
import { json } from "@/testing/fake-api";
import { expectNoAmounts } from "@/testing/privacy";
import { renderApp } from "@/testing/render-app";

const november = "/planning?tab=budgets&view=plan&month=2026-11";
const today = "2026-11-10";

function words(key: keyof typeof catalogEn, values: Record<string, string>) {
  return Object.entries(values).reduce<string>(
    (text, [k, v]) => text.replace(`{${k}}`, v),
    catalogEn[key],
  );
}

const panel = () =>
  screen.findByRole("region", { name: catalogEn["plan.panel"] });
// The unassigned figure tweens to a new amount; a loaded runner can hold animation frames.
const figure = async (text: string) =>
  within(await panel()).findByText(text, undefined, { timeout: 5000 });
const input = (name: string) =>
  screen.findByRole("textbox", { name: words("plan.input", { name }) });

async function renderPlan(fetch = budgetPlanApi(), path = november) {
  const view = await renderApp(path, { fetch, today });
  await panel();
  return view;
}

describe("Budget plan", () => {
  afterEach(() => {
    localStorage.removeItem("equori.privacy");
  });

  it("shows the unassigned amount of the month", async () => {
    await renderPlan();
    expect(within(await panel()).getByText("R$2,160.00")).toBeInTheDocument();
    expect(
      within(await panel()).getByText(
        words("plan.lead", { share: "74.6%", month: "November 2026" }),
      ),
    ).toBeInTheDocument();
  });

  it("recomputes while typing", async () => {
    await renderPlan();
    const field = await input("Energy");
    await userEvent.clear(field);
    await userEvent.type(field, "20500");
    expect(field).toHaveValue("205.00");
    // The figure moves to the new amount over 180 ms.
    expect(await figure("R$2,135.00")).toBeInTheDocument();
    expect(
      screen.getByText(words("plan.was", { amount: "R$180.00" })),
    ).toBeInTheDocument();
  });

  it("applies the average from the chip", async () => {
    await renderPlan();
    await userEvent.click(
      await screen.findByRole("button", {
        name: words("plan.averageChip", { amount: "R$205.00" }),
      }),
    );
    expect(await input("Energy")).toHaveValue("205.00");
  });

  it("reverts a row with Escape", async () => {
    await renderPlan();
    const field = await input("Energy");
    await userEvent.type(field, "0");
    expect(field).toHaveValue("1,800.00");
    await userEvent.keyboard("{Escape}");
    expect(field).toHaveValue("180.00");
    expect(await figure("R$2,160.00")).toBeInTheDocument();
  });

  it("moves to the next row with Enter", async () => {
    await renderPlan();
    await userEvent.click(await input("Energy"));
    await userEvent.keyboard("{Enter}");
    // Housing lists Condo, Energy and Rent in the tree's order.
    expect(await input("Rent")).toHaveFocus();
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
    expect(await input("Energy")).toHaveFocus();
  });

  it("saves only changed rows", async () => {
    let sent: unknown;
    const fetch = budgetPlanApi(undefined, {
      "PUT /api/v1/budget-plan": async (req: Request) => {
        sent = await req.json();
        return json(200, budgetPlan("2026-11"));
      },
    });
    await renderPlan(fetch);
    const field = await input("Energy");
    await userEvent.clear(field);
    await userEvent.type(field, "20500");
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["plan.save"] }),
    );
    await waitFor(() => {
      expect(sent).toEqual({
        source: "expected_income",
        amounts: [
          {
            category_id: energy.id,
            amount: { amount: 20500, currency: "BRL" },
          },
        ],
      });
    });
    expect(
      (
        await screen.findAllByText(
          words("plan.saved", { month: "November 2026" }),
        )
      )[0],
    ).toBeInTheDocument();
  });

  it("keeps changes when the save fails", async () => {
    const fetch = budgetPlanApi(undefined, {
      "PUT /api/v1/budget-plan": () =>
        json(422, {
          status: 422,
          code: "validation_failed",
          title: "Unprocessable",
          detail:
            "amounts[0].category_id: must be an open expense category of the user",
          errors: [
            {
              field: "amounts[0].category_id",
              message: "must be an open expense category of the user",
            },
          ],
        }),
    });
    await renderPlan(fetch);
    const field = await input("Market");
    await userEvent.type(field, "0");
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["plan.save"] }),
    );
    expect(
      await screen.findByText(catalogEn["plan.saveFailed"]),
    ).toBeInTheDocument();
    expect(field).toHaveValue("11,000.00");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(
      screen.getByRole("button", { name: catalogEn["plan.save"] }),
    ).toBeInTheDocument();
  });

  it("opens Track by default for the current month and Plan for a later one", async () => {
    const view = await renderApp("/planning?tab=budgets&month=2026-11", {
      fetch: budgetPlanApi(),
      today,
    });
    expect(
      await screen.findByRole("radio", { name: catalogEn["plan.view.track"] }),
    ).toBeChecked();
    view.unmount();
    await renderApp("/planning?tab=budgets&month=2026-12", {
      fetch: budgetPlanApi(),
      today,
    });
    expect(
      await screen.findByRole("radio", { name: catalogEn["plan.view.plan"] }),
    ).toBeChecked();
    await panel();
  });

  it("shows a bar segment per group with its share", async () => {
    await renderPlan();
    expect(
      await screen.findByRole("button", {
        name: words("plan.segment", {
          name: "Housing",
          amount: "R$2,830.00",
          share: "33.3%",
        }),
      }),
    ).toBeInTheDocument();
  });

  it("hides amounts in privacy mode", async () => {
    localStorage.setItem("equori.privacy", "hidden");
    const { container } = await renderPlan();
    expect(
      await screen.findByText(catalogEn["plan.privacy"]),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", {
        name: words("plan.input", { name: "Energy" }),
      }),
    ).not.toBeInTheDocument();
    expectNoAmounts(container, ["2,160.00", "180.00", "8,500.00"]);
  });

  it("reviews a suggestion before applying it", async () => {
    let saves = 0;
    const fetch = budgetPlanApi(undefined, {
      "PUT /api/v1/budget-plan": () => {
        saves += 1;
        return json(200, budgetPlan("2026-11"));
      },
    });
    await renderPlan(fetch);
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["plan.suggest"] }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", {
        name: catalogEn["plan.suggest.average"],
      }),
    );
    expect(
      await screen.findByText(
        words("plan.review", {
          basis: "3-month average",
          count: "8",
          delta: "+R$715.00",
          rest: "R$1,445.00",
        }),
      ),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("checkbox", {
        name: words("plan.take", { name: "Restaurants" }),
      }),
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: words("plan.applyChecked", { count: "7" }),
      }),
    );
    expect(await input("Energy")).toHaveValue("205.00");
    expect(await input("Restaurants")).toHaveValue("400.00");
    expect(saves).toBe(0);
    const [undo] = await screen.findAllByRole("button", {
      name: catalogEn["plan.undo"],
    });
    if (undo === undefined) throw new Error("no undo action");
    await userEvent.click(undo);
    await waitFor(async () => {
      expect(await input("Energy")).toHaveValue("180.00");
    });
  });

  it("fits a suggestion to the reference", async () => {
    await renderPlan();
    await userEvent.click(
      screen.getByRole("radio", { name: catalogEn["plan.source.fixed"] }),
    );
    const fixed = await screen.findByRole("textbox", {
      name: catalogEn["plan.fixedAmount"],
    });
    await userEvent.clear(fixed);
    await userEvent.type(fixed, "600000");
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["plan.suggest"] }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", {
        name: catalogEn["plan.suggest.average"],
      }),
    );
    expect(
      await screen.findByRole("switch", { name: catalogEn["plan.fit"] }),
    ).toBeChecked();
    await userEvent.click(
      screen.getByRole("button", {
        name: words("plan.applyChecked", { count: "8" }),
      }),
    );
    expect(await figure("R$0.00")).toBeInTheDocument();
  });

  it("distributes the rest in proportion", async () => {
    await renderPlan();
    await userEvent.click(
      screen.getByRole("button", { name: catalogEn["plan.distribute"] }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", {
        name: catalogEn["plan.distribute.proportional"],
      }),
    );
    expect(await figure("R$0.00")).toBeInTheDocument();
    expect(await input("Rent")).toHaveValue("3,033.68");
  });

  it("asks before discarding pending changes", async () => {
    await renderPlan();
    await userEvent.type(await input("Energy"), "0");
    await userEvent.click(
      screen.getByRole("radio", { name: catalogEn["plan.view.track"] }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: catalogEn["plan.discardTitleOne"],
    });
    await userEvent.click(
      within(dialog).getByRole("button", {
        name: catalogEn["plan.keepEditing"],
      }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(await input("Energy")).toHaveValue("1,800.00");
    expect(
      screen.getByRole("radio", { name: catalogEn["plan.view.plan"] }),
    ).toBeChecked();
  });

  it("reads past months only", async () => {
    await renderPlan(
      budgetPlanApi(),
      "/planning?tab=budgets&view=plan&month=2026-10",
    );
    expect(
      await screen.findByText(catalogEn["plan.pastMonth"]),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("textbox", {
        name: words("plan.input", { name: "Energy" }),
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: catalogEn["plan.suggest"] }),
    ).not.toBeInTheDocument();
  });

  it("lists top-level categories when there is no history", async () => {
    await renderPlan(
      budgetPlanApi((month) =>
        budgetPlan(month, {
          rows: [],
          planned: money(0),
          unassigned: money(786000),
        }),
      ),
    );
    expect(await input("Housing")).toHaveValue("0.00");
    expect(await input("Gifts")).toHaveValue("0.00");
    expect(
      screen.queryByRole("textbox", {
        name: words("plan.input", { name: "Rent" }),
      }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(catalogEn["plan.noHistory"])).toBeInTheDocument();
  });

  it("keeps the save bar and drops the history columns on a phone", async () => {
    await renderApp(november, { fetch: budgetPlanApi(), today, width: 390 });
    await panel();
    await userEvent.type(await input("Energy"), "0");
    expect(
      await screen.findByRole("button", { name: catalogEn["plan.save"] }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", {
        name: catalogEn["plan.col.average"],
      }),
    ).not.toBeInTheDocument();
  });

  it("hides the fixed reference in privacy mode", async () => {
    localStorage.setItem("equori.privacy", "hidden");
    const { container } = await renderPlan(
      budgetPlanApi((month) =>
        budgetPlan(month, {
          source: "fixed",
          fixed: money(600000),
          reference: money(600000),
          unassigned: money(-34000),
        }),
      ),
    );
    await screen.findByText(catalogEn["plan.privacy"]);
    expectNoAmounts(container, ["6,000.00", "600000", "340.00"]);
  });
});
