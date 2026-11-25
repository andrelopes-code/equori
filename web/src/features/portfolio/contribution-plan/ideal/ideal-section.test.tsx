import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";

import type { components } from "@/api/schema.gen";

import { catalogEn } from "@/i18n/catalog.en";
import { IdealSection } from "@/features/portfolio/contribution-plan/ideal/ideal-section";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

// A group row is a name and a bar of its own length: equal blocks stacked 4 px apart are not it.
it("reserves the group rows as lines of different lengths", () => {
  const { container } = renderWithProviders(
    <IdealSection view={undefined} pending memberName={() => ""} />,
    { fetch: fakeApi({}) },
  );

  const lines = [...container.querySelectorAll('[data-ui="skeleton"]')];
  const sizes = new Set(lines.map((line) => line.getAttribute("style")));

  expect(lines).toHaveLength(5);
  expect(sizes.size).toBeGreaterThan(1);
});

// S642: the members of an open group by rule are its matched securities, with their share of the
// group and no ideal of their own.
it("draws one row per matched security of an open group by rule", async () => {
  const brl = (amount: number) => ({ amount, currency: "BRL" });
  const view: components["schemas"]["ContributionPlan"] = {
    status: "complete",
    total: brl(1000000),
    drift_bp: 0,
    classes: [
      {
        name: "Pós",
        target_bp: 10000,
        value: brl(1000000),
        share_bp: 10000,
        questions: [],
        question_facts: [],
        question_limits: [],
        question_ideals: false,
        question_effects: [],
        question_reviews: [],
        held: false,
        rules: [{ instrument_type: "fixed_income" }],
        matched: [
          { instrument: "CDB1", value: brl(600000), share_bp: 6000 },
          { instrument: "CDB2", value: brl(400000), share_bp: 4000 },
        ],
        members: [],
      },
    ],
    outside: [],
    missing: [],
    revision: 1,
    holds_ignored: false,
  };
  const user = userEvent.setup();
  renderWithProviders(
    <IdealSection
      view={view}
      pending={false}
      memberName={(ref) => ref.instrument ?? ""}
    />,
    { fetch: fakeApi({}) },
  );

  await user.click(
    screen.getByRole("button", {
      name: catalogEn["contributionPlan.showAssets"].replace("{name}", "Pós"),
    }),
  );

  expect(screen.getByText("CDB1")).toBeVisible();
  expect(screen.getByText("CDB2")).toBeVisible();
  expect(
    screen.getAllByText(/^no target of its own \(today .* of the group\)$/),
  ).toHaveLength(2);
});
