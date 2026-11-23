import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { components } from "@/api/schema.gen";
import { GroupAssetsPanel } from "@/features/portfolio/contribution-plan/editor/group-assets-panel";
import type { PlanEditor } from "@/features/portfolio/contribution-plan/editor/use-plan-editor";
import { byRuleDraft } from "@/features/portfolio/contribution-plan/rules/rule-fixtures";
import { catalogEn } from "@/i18n/catalog.en";
import { fakeApi, json } from "@/testing/fake-api";
import { renderWithProviders } from "@/testing/render-app";

type Group = components["schemas"]["ContributionClass"];

const brl = (amount: number) => ({ amount, currency: "BRL" });

const group: Group = {
  name: "Pós",
  target_bp: 10000,
  value: brl(100000),
  share_bp: 10000,
  questions: [],
  question_facts: [],
  question_limits: [],
  question_ideals: false,
  rules: [],
  matched: [],
  members: [{ instrument: "CDB1", value: brl(100000), share_bp: 10000 }],
};

const matchedGroup: Group = {
  ...group,
  members: [],
  matched: [{ instrument: "LCI9", value: brl(5000), share_bp: 10000 }],
};

function mount(byRuleMode = false) {
  const draft = byRuleDraft([]);
  const [first] = draft.classes;
  if (first === undefined) throw new Error("the draft has no group");
  const edit = {
    ...first,
    byRule: byRuleMode,
    members: [{ instrument: "CDB1" }],
    memberLocks: [false],
  };
  const setByRule = vi.fn();
  const editor = { draft, setByRule } as unknown as PlanEditor;

  renderWithProviders(
    <GroupAssetsPanel
      id="panel"
      index={0}
      group={byRuleMode ? matchedGroup : group}
      edit={edit}
      editor={editor}
      memberName={(ref) => ref.instrument ?? ""}
      onAddAsset={() => undefined}
    />,
    {
      fetch: fakeApi({ "GET /api/v1/contribution-plan": () => json(200, {}) }),
    },
  );

  return { setByRule, user: userEvent.setup() };
}

const byRule = () =>
  screen.getByRole("radio", {
    name: catalogEn["contributionPlan.rule.mode.byRule"],
  });

describe("GroupAssetsPanel mode change", () => {
  it("drops the chosen assets after the confirmation", async () => {
    const { setByRule, user } = mount();

    await user.click(byRule());
    expect(
      await screen.findByText(
        catalogEn["contributionPlan.rule.mode.dropMembersOne"],
      ),
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", {
        name: catalogEn["contributionPlan.rule.mode.confirm"],
      }),
    );

    expect(setByRule).toHaveBeenCalledWith(0, true);
  });

  it("keeps the chosen assets when the reader keeps them", async () => {
    const { setByRule, user } = mount();

    await user.click(byRule());
    await user.click(
      await screen.findByRole("button", {
        name: catalogEn["contributionPlan.rule.mode.keep"],
      }),
    );

    expect(setByRule).not.toHaveBeenCalled();
  });
});

describe("GroupAssetsPanel by rule", () => {
  it("draws the matched securities instead of the chosen assets", async () => {
    mount(true);

    expect(await screen.findByText("LCI9")).toBeVisible();
    expect(screen.queryByText("CDB1")).toBeNull();
    expect(
      screen.getByText(catalogEn["contributionPlan.rule.intro"]),
    ).toBeVisible();
  });
});
