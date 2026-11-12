import { describe, expect, it } from "vitest";

import {
  addMember,
  overlayDraft,
  removeClass,
  setClassTarget,
  setMemberTarget,
  setSplit,
  startEditing,
} from "@/features/portfolio/contribution-plan/model/plan-edits";

const plan = () =>
  startEditing({
    classes: [
      { name: "Renda fixa", targetBp: 4000, members: [] },
      {
        name: "Ações Brasil",
        targetBp: 2000,
        members: [
          { instrument: "PETR4", targetBp: 6000 },
          { instrument: "VALE3", targetBp: 4000 },
        ],
      },
      { name: "Ações exterior", targetBp: 2000, members: [] },
      { name: "FIIs", targetBp: 2000, members: [] },
    ],
  });

const targets = (draft: ReturnType<typeof plan>) =>
  draft.classes.map((c) => c.targetBp);

describe("plan edits", () => {
  it("spreads a class change over the others in proportion", () => {
    expect(targets(setClassTarget(plan(), 1, 3000))).toEqual([
      3500, 3000, 1750, 1750,
    ]);
  });

  it("keeps a locked class at its value", () => {
    const draft = plan();
    const locked = {
      ...draft,
      classes: draft.classes.map((c, i) => ({ ...c, locked: i === 0 })),
    };

    expect(targets(setClassTarget(locked, 1, 3000))).toEqual([
      4000, 3000, 1500, 1500,
    ]);
  });

  it("gives the target of a removed class to the others", () => {
    const removed = removeClass(plan(), 3);

    expect(removed.classes.map((c) => c.name)).toEqual([
      "Renda fixa",
      "Ações Brasil",
      "Ações exterior",
    ]);
    expect(targets(removed)).toEqual([5000, 2500, 2500]);
  });

  it("clears the member targets when the split goes off", () => {
    const off = setSplit(plan(), 1, false).classes[1];

    expect(off?.split).toBe(false);
    expect(off?.members).toEqual([
      { instrument: "PETR4" },
      { instrument: "VALE3" },
    ]);
  });

  it("gives equal member targets that add up to 10000 when the split goes on", () => {
    const draft = addMember(setSplit(plan(), 0, true), 0, { instrument: "A" });
    const three = addMember(addMember(draft, 0, { instrument: "B" }), 0, {
      instrument: "C",
    });

    expect(
      setSplit(setSplit(three, 0, false), 0, true).classes[0]?.members,
    ).toEqual([
      { instrument: "A", targetBp: 3334 },
      { instrument: "B", targetBp: 3333 },
      { instrument: "C", targetBp: 3333 },
    ]);
  });

  it("moves a member target inside its class", () => {
    expect(
      setMemberTarget(plan(), 1, 0, 7000).classes[1]?.members.map(
        (m) => m.targetBp,
      ),
    ).toEqual([7000, 3000]);
  });
});

describe("overlayDraft", () => {
  const money = (amount: number) => ({ amount, currency: "BRL" });
  const view = {
    status: "complete" as const,
    total: money(1000),
    classes: [
      {
        name: "Old A",
        target_bp: 5000,
        value: money(600),
        share_bp: 6000,
        members: [
          {
            instrument: "PETR4",
            target_bp: 7000,
            value: money(400),
            share_bp: 4000,
          },
          { account_id: "a1", value: money(200), share_bp: 2000 },
        ],
      },
    ],
    outside: [],
    missing: [],
  };

  it("takes names, targets and members from the draft and figures from the view", () => {
    const draft = startEditing({
      classes: [
        {
          name: "New A",
          targetBp: 3000,
          members: [
            { accountId: "a1", targetBp: 1000 },
            { instrument: "PETR4" },
          ],
        },
        { name: "New B", targetBp: 7000, members: [] },
      ],
    });

    expect(overlayDraft(view, draft).classes).toEqual([
      {
        name: "New A",
        target_bp: 3000,
        value: money(600),
        share_bp: 6000,
        members: [
          {
            account_id: "a1",
            target_bp: 1000,
            value: money(200),
            share_bp: 2000,
          },
          { instrument: "PETR4", value: money(400), share_bp: 4000 },
        ],
      },
      { name: "New B", target_bp: 7000, value: money(0), members: [] },
    ]);
  });

  it("reads zero for a member the view lacks", () => {
    const draft = startEditing({
      classes: [
        { name: "Old A", targetBp: 5000, members: [{ instrument: "VALE3" }] },
      ],
    });

    expect(overlayDraft(view, draft).classes[0]?.members).toEqual([
      { instrument: "VALE3", value: money(0) },
    ]);
  });
});
