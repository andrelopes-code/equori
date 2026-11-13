import { describe, expect, it } from "vitest";

import { compositionGroups } from "@/features/portfolio/contribution-plan/editor/composition-groups";
import { startEditing } from "@/features/portfolio/contribution-plan/model/plan-edits";
import type { components } from "@/api/schema.gen";

type Plan = components["schemas"]["ContributionPlan"];

const brl = (amount: number) => ({ amount, currency: "BRL" });

const view = {
  status: "complete",
  total: brl(1000000),
  drift_bp: 0,
  classes: [
    {
      name: "A",
      target_bp: 6000,
      value: brl(0),
      share_bp: 3000,
      amount: brl(5000),
      members: [],
    },
    { name: "B", target_bp: 4000, value: brl(0), members: [], amount: brl(0) },
  ],
  outside: [],
  missing: [],
} as Plan;

describe("compositionGroups", () => {
  it("takes names, ideals and locks from the draft and figures from the view", () => {
    const draft = startEditing({
      classes: [
        { name: "A", targetBp: 5000, members: [] },
        { name: "B", targetBp: 4000, members: [] },
        { name: "C", targetBp: 1000, members: [] },
      ],
    });
    draft.classes = draft.classes.map((c, i) => ({ ...c, locked: i === 1 }));

    expect(compositionGroups(view, draft)).toEqual([
      {
        key: "group-0",
        name: "A",
        colour: 0,
        targetBp: 5000,
        locked: false,
        todayBp: 3000,
        amount: brl(5000),
      },
      { key: "group-1", name: "B", colour: 1, targetBp: 4000, locked: true },
      { key: "group-2", name: "C", colour: 2, targetBp: 1000, locked: false },
    ]);
  });
});
