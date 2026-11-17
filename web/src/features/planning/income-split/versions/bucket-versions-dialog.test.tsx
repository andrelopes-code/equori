import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { catalogEn } from "@/i18n/catalog.en";
import { money } from "@/testing/account-api";
import { budgetPlan, budgetPlanApi } from "@/testing/budget-plan-api";
import { json } from "@/testing/fake-api";
import { renderApp } from "@/testing/render-app";

const november = "/planning?tab=budgets&view=plan&month=2026-11";
const today = "2026-11-10";

const bucket = (id: string, name: string, share_bp: number) => ({
  id,
  name,
  share_bp,
  takes_savings: false,
  takes_goals: false,
  at_least: false,
  category_ids: [],
});
const needs = (share_bp: number) =>
  bucket("b0000000-0000-4000-8000-000000000001", "Needs", share_bp);
const wants = (share_bp: number) =>
  bucket("b0000000-0000-4000-8000-000000000002", "Wants", share_bp);
const versions = [
  { from: "2026-09", buckets: [needs(5000), wants(5000)] },
  { from: "2026-11", buckets: [needs(6000), wants(4000)] },
];

const withBuckets = (month: string) =>
  budgetPlan(month, {
    buckets: [needs(6000), wants(4000)].map((b) => ({
      ...b,
      planned: money(0),
      spent: money(0),
    })),
    outside_planned: money(0),
    outside_spent: money(0),
  });

const deleteButtons = (dialog: HTMLElement) =>
  within(dialog).getAllByRole("button", {
    name: catalogEn["buckets.version.delete"],
  });

async function open(deleted: string[] = []) {
  const fetch = budgetPlanApi(withBuckets, {
    "GET /api/v1/budget-buckets/versions": () => json(200, { versions }),
    "DELETE /api/v1/budget-buckets/versions/2026-11": (req: Request) => {
      deleted.push(new URL(req.url).pathname);
      return new Response(null, { status: 204 });
    },
  });
  await renderApp(november, { fetch, today });
  await userEvent.click(
    await screen.findByRole("button", { name: catalogEn["buckets.history"] }),
  );
  return screen.findByRole("dialog");
}

describe("Versions of the income split", () => {
  it("lists the versions, the latest first, with the change of each share", async () => {
    const dialog = await open();

    const headings = within(dialog).getAllByText(/^Since |^From the start$/);
    expect(headings.map((h) => h.textContent)).toEqual([
      "Since November 2026",
      "From the start",
    ]);
    expect(within(dialog).getAllByText("was 50.0%")).toHaveLength(2);
    expect(within(dialog).getByText("60.0%")).toBeVisible();
    expect(
      within(dialog).getByText(catalogEn["buckets.version.inForce"]),
    ).toBeVisible();
  });

  it("deletes a version after a confirmation", async () => {
    const deleted: string[] = [];
    const dialog = await open(deleted);

    await userEvent.click(deleteButtons(dialog)[0] ?? dialog);
    expect(
      within(dialog).getByText(
        "Its months return to the version of September 2026.",
      ),
    ).toBeVisible();
    await userEvent.click(
      // The confirmation sits in the first block, above the other block's Delete.
      deleteButtons(dialog)[0] ?? dialog,
    );

    await waitFor(() => {
      expect(deleted).toEqual(["/api/v1/budget-buckets/versions/2026-11"]);
    });
  });
});
