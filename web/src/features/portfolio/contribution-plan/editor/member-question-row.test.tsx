import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { components } from "@/api/schema.gen";
import { MemberQuestionRow } from "@/features/portfolio/contribution-plan/editor/member-question-row";
import type { PlanEditor } from "@/features/portfolio/contribution-plan/editor/use-plan-editor";
import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

vi.mock(import("@/features/instruments"), async (importOriginal) => ({
  ...(await importOriginal()),
  AssetFacts: () => <span>asset facts</span>,
}));

type Member = components["schemas"]["ContributionMember"];

const brl = (amount: number) => ({ amount, currency: "BRL" });

const member: Member = {
  instrument: "PETR4",
  value: brl(100000),
  share_bp: 10000,
  answers: [false, true],
  fact_answers: ["yes", "none"],
  facts_year: "2025-12-31",
};

const withoutYear: Member = {
  instrument: "PETR4",
  value: brl(100000),
  share_bp: 10000,
  answers: [false, true],
};

function mount(row: Member, facts: string[]) {
  renderWithProviders(
    <MemberQuestionRow
      index={0}
      at={0}
      member={row}
      name="PETR4"
      questions={["First", "Second"]}
      facts={facts}
      ideals
      editor={{} as PlanEditor}
    />,
    { fetch: fakeApi({}) },
  );
}

describe("MemberQuestionRow facts", () => {
  it("shows the fact answer read-only and counts the effective answers", () => {
    mount(member, ["piotroski_p1", ""]);

    const [first, second] = screen.getAllByRole("checkbox");
    expect(first).toBeChecked();
    expect(first).toHaveAttribute("aria-readonly", "true");
    expect(second).toBeChecked();
    expect(second).not.toHaveAttribute("aria-readonly", "true");
    expect(screen.getByText("2 of 2 yes")).toBeVisible();
  });

  it("names the filings in the accessible name of a decided answer", () => {
    mount(member, ["piotroski_p1", ""]);

    expect(
      screen.getByRole("checkbox", {
        name: "Positive return on assets, from the filings",
      }),
    ).toBeVisible();
  });

  it("starts the facts line with the fiscal year", () => {
    mount(member, ["piotroski_p1", ""]);

    expect(screen.getByText("signals of fiscal year 2025")).toBeVisible();
  });

  it("states that the filings are absent when the member has no fiscal year", () => {
    mount({ ...withoutYear, fact_answers: ["none", "none"] }, [
      "piotroski_p1",
      "",
    ]);

    expect(
      screen.getByText(catalogEn["contributionPlan.facts.none"]),
    ).toBeVisible();
  });

  it("keeps the account line for an account", () => {
    mount({ account_id: "a1", value: brl(1), share_bp: 1, answers: [] }, [
      "piotroski_p1",
      "",
    ]);

    expect(
      screen.getByText(catalogEn["contributionPlan.questions.noFacts"]),
    ).toBeVisible();
  });
});
