import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { money } from "@/testing/account-api";
import {
  budgetPlan,
  budgetPlanApi,
  food,
  housing,
} from "@/testing/budget-plan-api";
import { renderApp } from "@/testing/render-app";

const november = "/planning?tab=budgets&view=plan&month=2026-11";
const today = "2026-11-10";

const withBuckets = (month: string) =>
  budgetPlan(month, {
    buckets: [
      {
        id: "b0000000-0000-4000-8000-000000000001",
        name: "Needs",
        share_bp: 10000,
        takes_savings: true,
        takes_goals: true,
        at_least: false,
        category_ids: [housing.id, food.id],
        planned: money(0),
        spent: money(0),
      },
    ],
    outside_planned: money(0),
    outside_spent: money(0),
  });

describe("Earlier installments", () => {
  // Budget plan A129: the installments row opens the charges it sums.
  it("lists the charges behind the installments row", async () => {
    await renderApp(november, { fetch: budgetPlanApi(withBuckets), today });
    const split = await screen.findByRole("table", {
      name: catalogEn["buckets.title"],
    });

    await userEvent.click(
      within(split).getByRole("button", {
        name: catalogEn["plan.installments"],
      }),
    );

    const table = await screen.findByRole("table", {
      name: catalogEn["plan.installments.caption"],
    });
    const rows = within(table)
      .getAllByRole("row")
      .map((r) => r.textContent);
    expect(rows.slice(1)).toEqual([
      expect.stringMatching(/^Notebook.*3\/10R\$400\.00$/),
      expect.stringMatching(
        new RegExp(
          `^Chair.*${catalogEn["plan.installments.anticipation"]}R\\$240\\.00$`,
        ),
      ),
      `${catalogEn["plan.installments.total"]}R$640.00`,
    ]);
  });
});
