import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PlanEditor } from "@/features/portfolio/contribution-plan/editor/use-plan-editor";
import type { Rule } from "@/features/portfolio/contribution-plan/model/plan-draft";
import { RuleList } from "@/features/portfolio/contribution-plan/rules/rule-list";
import {
  byRuleDraft,
  previewRoute,
} from "@/features/portfolio/contribution-plan/rules/rule-fixtures";
import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

const rate: Rule = { instrument_type: "fixed_income", return_kind: "rate" };
const inflation: Rule = {
  instrument_type: "fixed_income",
  return_kind: "inflation",
  matures_from_year: 2031,
  matures_to_year: 2035,
};

function mount(rules: Rule[]) {
  const draft = byRuleDraft(rules);
  const [edit] = draft.classes;
  if (edit === undefined) throw new Error("the draft has no group");
  const editor = {
    draft,
    addRule: vi.fn(),
    replaceRule: vi.fn(),
    removeRule: vi.fn(),
  } as unknown as PlanEditor;
  const fetch = fakeApi({
    "GET /api/v1/contribution-plan": () => json(200, {}),
    "GET /api/v1/instruments": () => json(200, { items: [] }),
    "GET /api/v1/instrument-subtypes": () => json(200, { items: [] }),
    "POST /api/v1/contribution-plan/preview": previewRoute,
  });

  renderWithProviders(<RuleList index={0} edit={edit} editor={editor} />, {
    fetch,
  });

  return editor;
}

const addButton = () =>
  screen.getByRole("button", { name: catalogEn["contributionPlan.rule.add"] });

describe("RuleList", () => {
  it("draws one row per rule with its summary and its count", async () => {
    mount([rate, inflation]);

    expect(await screen.findAllByRole("listitem")).toHaveLength(2);
    expect(
      screen.getByText(
        "Fixed income · Inflation-linked · matures 2031 to 2035",
      ),
    ).toBeVisible();
    await waitFor(() => {
      expect(screen.getAllByText(/^1 asset · /)).toHaveLength(2);
    });
  });

  it("enables the add button below five rules", () => {
    mount([rate]);

    expect(addButton()).toBeEnabled();
  });

  it("disables the add button at five rules", () => {
    mount([rate, rate, rate, rate, rate]);

    expect(addButton()).toBeDisabled();
  });

  it("opens the dialog of a rule with its edit button", async () => {
    mount([rate]);

    await userEvent.setup().click(
      await screen.findByRole("button", {
        name: catalogEn["contributionPlan.rule.edit"],
      }),
    );

    expect(await screen.findByText("Rule of the group Pós")).toBeVisible();
  });

  it("removes a rule with its remove button", async () => {
    const editor = mount([rate, inflation]);

    const [first] = await screen.findAllByRole("button", {
      name: catalogEn["contributionPlan.rule.remove"],
    });
    if (first === undefined) throw new Error("no remove button");
    await userEvent.setup().click(first);

    expect(editor.removeRule).toHaveBeenCalledWith(0, 0);
  });
});
