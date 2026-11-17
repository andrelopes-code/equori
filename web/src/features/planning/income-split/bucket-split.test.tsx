import { screen, waitFor, within } from "@testing-library/react";
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
import { json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

const november = "/planning?tab=budgets&view=plan&month=2026-11";
const today = "2026-11-10";

const buckets = [
  {
    id: "b0000000-0000-4000-8000-000000000001",
    name: "Needs",
    share_bp: 6000,
    takes_savings: false,
    takes_goals: false,
    at_least: false,
    category_ids: [housing.id, food.id],
    planned: money(0),
    spent: money(500000),
  },
  {
    id: "b0000000-0000-4000-8000-000000000002",
    name: "Freedom",
    share_bp: 4000,
    takes_savings: true,
    takes_goals: false,
    at_least: false,
    category_ids: [],
    planned: money(0),
    spent: money(0),
  },
];

const withBuckets = (month: string) =>
  budgetPlan(month, {
    buckets,
    outside_planned: money(0),
    outside_spent: money(2500),
  });

const splitTable = () =>
  screen.findByRole("table", { name: catalogEn["buckets.title"] });

describe("Income split", () => {
  it("invites to set up a split when the book has none", async () => {
    await renderApp(november, { fetch: budgetPlanApi(), today });

    expect(await screen.findByText(catalogEn["buckets.empty"])).toBeVisible();
    expect(
      screen.getByRole("button", { name: catalogEn["buckets.setUp"] }),
    ).toBeVisible();
  });

  // Income buckets spec 5: target, planned and spent per bucket, the rest outside.
  it("states each bucket's plan against its target", async () => {
    await renderApp(november, { fetch: budgetPlanApi(withBuckets), today });

    const rows = within(await splitTable()).getAllByRole("row");
    const needs = rows.find((r) => r.textContent.includes("Needs"));
    const freedom = rows.find((r) => r.textContent.includes("Freedom"));
    const outside = rows.find((r) =>
      r.textContent.includes(catalogEn["buckets.outside"]),
    );

    // Income buckets spec 5, Plan: the target against the plan, not against the spending.
    // 60% of R$8,500.00 is R$5,100.00; housing and food plan R$4,330.00.
    expect(needs?.textContent).toContain("R$5,100.00");
    expect(needs?.textContent).toContain("R$4,330.00");
    expect(needs?.textContent).toContain("R$770.00 to plan");
    expect(needs?.textContent).not.toContain("R$5,000.00");
    expect(freedom?.textContent).toContain(catalogEn["buckets.withSavings"]);
    expect(freedom?.textContent).toContain("R$3,400.00 to plan");
    // Transport, leisure and health plan R$1,370.00 outside the split.
    expect(outside?.textContent).toContain("R$1,370.00");
  });

  it("saves the split only when the shares sum to 100%", async () => {
    let sent: unknown;
    const fetch = budgetPlanApi(withBuckets, {
      "PUT /api/v1/budget-buckets": async (req: Request) => {
        sent = await req.json();
        return new Response(null, { status: 204 });
      },
    });
    await renderApp(november, { fetch, today });
    await userEvent.click(
      await screen.findByRole("button", { name: catalogEn["buckets.edit"] }),
    );
    const dialog = await screen.findByRole("dialog");
    const shares = within(dialog).getAllByRole("textbox", {
      name: catalogEn["buckets.field.share"],
    });
    const share = (index: number) => {
      const field = shares[index];
      if (field === undefined)
        throw new Error(`no share field ${String(index)}`);
      return field;
    };
    const save = within(dialog).getByRole("button", {
      name: catalogEn["buckets.save"],
    });

    await userEvent.clear(share(0));
    await userEvent.type(share(0), "50");

    expect(
      within(dialog).getByText(
        catalogEn["buckets.totalWrong"].replace("{total}", "90.0%"),
      ),
    ).toBeVisible();
    expect(save).toBeDisabled();

    await userEvent.clear(share(1));
    await userEvent.type(share(1), "50");
    await userEvent.click(save);

    await waitFor(() => {
      expect(sent).toEqual({
        from: "2026-11",
        buckets: [
          {
            id: buckets[0]?.id,
            name: "Needs",
            share_bp: 5000,
            takes_savings: false,
            takes_goals: false,
            at_least: false,
            // In the order of the category tree.
            category_ids: [food.id, housing.id],
          },
          {
            id: buckets[1]?.id,
            name: "Freedom",
            share_bp: 5000,
            takes_savings: true,
            takes_goals: false,
            at_least: false,
            category_ids: [],
          },
        ],
      });
    });
  });

  describe("with a version stored", () => {
    const versions = [{ from: "2026-09", buckets }];

    async function open() {
      const sent: unknown[] = [];
      const fetch = budgetPlanApi(withBuckets, {
        "GET /api/v1/budget-buckets/versions": () => json(200, { versions }),
        "PUT /api/v1/budget-buckets": async (req: Request) => {
          sent.push(await req.json());
          return new Response(null, { status: 204 });
        },
      });
      await renderApp(november, { fetch, today });
      await userEvent.click(
        await screen.findByRole("button", { name: catalogEn["buckets.edit"] }),
      );
      const dialog = await screen.findByRole("dialog");
      await within(dialog).findByRole("combobox", {
        name: catalogEn["buckets.from.label"],
      });
      return { sent, dialog };
    }

    const save = (dialog: HTMLElement) =>
      within(dialog).getByRole("button", { name: catalogEn["buckets.save"] });

    it("saves from the month on screen", async () => {
      const { sent, dialog } = await open();

      await userEvent.click(save(dialog));

      await waitFor(() => {
        expect(sent).toHaveLength(1);
      });
      expect(sent[0]).toMatchObject({ from: "2026-11" });
    });

    it("saves from the start of the version in force", async () => {
      const { sent, dialog } = await open();

      await userEvent.click(
        within(dialog).getByRole("combobox", {
          name: catalogEn["buckets.from.label"],
        }),
      );
      await userEvent.click(
        await screen.findByRole("option", {
          name: catalogEn["buckets.from.start"],
        }),
      );
      await userEvent.click(save(dialog));

      await waitFor(() => {
        expect(sent).toHaveLength(1);
      });
      expect(sent[0]).toMatchObject({ from: "2026-09" });
    });

    it("ends the split from the chosen month after a confirmation", async () => {
      const { sent, dialog } = await open();

      await userEvent.click(
        within(dialog).getByRole("button", { name: catalogEn["buckets.end"] }),
      );

      expect(sent).toEqual([]);
      expect(
        within(dialog).getByText(
          catalogEn["buckets.endConfirm"].replace("{month}", "November 2026"),
        ),
      ).toBeVisible();

      const confirm = within(dialog).getAllByRole("button", {
        name: catalogEn["buckets.end"],
      })[0];
      if (confirm === undefined) throw new Error("no confirm button");
      await userEvent.click(confirm);

      await waitFor(() => {
        expect(sent).toEqual([{ buckets: [], from: "2026-11" }]);
      });
    });
  });
});
