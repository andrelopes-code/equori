import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { budgetPlan, budgetPlanApi, energy } from "@/testing/budget-plan-api";
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
    expect(
      await within(await panel()).findByText("R$2,135.00"),
    ).toBeInTheDocument();
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
    expect(
      await within(await panel()).findByText("R$2,160.00"),
    ).toBeInTheDocument();
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
});
