import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  toDraft,
  toInput,
} from "@/features/portfolio/contribution-plan/model/plan-draft";
import {
  addMember,
  renameClass,
  setSplit,
  startEditing,
} from "@/features/portfolio/contribution-plan/model/plan-edits";

type Plan = components["schemas"]["ContributionPlan"];

const brl = (amount: number) => ({ amount, currency: "BRL" });

const view: Plan = {
  status: "complete",
  total: brl(0),
  revision: 3,
  holds_ignored: false,
  outside: [],
  missing: [],
  classes: [
    {
      name: "Cripto",
      target_bp: 10000,
      value: brl(0),
      questions: ["Medo?"],
      question_facts: [""],
      question_limits: [""],
      question_effects: ["hold"],
      question_reviews: [1],
      question_ideals: false,
      held: true,
      rules: [],
      matched: [],
      members: [
        {
          instrument: "ABTC11",
          target_bp: 6000,
          value: brl(0),
          answers: [false],
          answer_dates: ["2026-10-12"],
          answer_overrides: [false],
          released: true,
        },
        {
          instrument: "AETH11",
          target_bp: 4000,
          value: brl(0),
          answers: [null],
          answer_dates: [null],
          answer_overrides: [false],
        },
      ],
    },
  ],
};

describe("the conditions of a draft", () => {
  it("are sent as they were read, with the typed ideals", () => {
    expect(toInput(toDraft(view)).classes[0]).toEqual({
      name: "Cripto",
      target_bp: 10000,
      questions: ["Medo?"],
      question_effects: ["hold"],
      question_reviews: [1],
      members: [
        {
          instrument: "ABTC11",
          target_bp: 6000,
          answers: [false],
          answer_dates: ["2026-10-12"],
          answer_overrides: [false],
          released: true,
        },
        {
          instrument: "AETH11",
          target_bp: 4000,
          answers: [null],
          answer_dates: [null],
          answer_overrides: [false],
        },
      ],
    });
  });

  it("stay with a group renamed in the editor", () => {
    const draft = renameClass(startEditing(toDraft(view)), 0, "Moedas");
    const [cls] = toInput(draft).classes;

    expect(cls?.question_effects).toEqual(["hold"]);
    expect(cls?.members[0]?.answer_dates).toEqual(["2026-10-12"]);
  });

  it("stay when the split of the group leaves", () => {
    const draft = setSplit(startEditing(toDraft(view)), 0, false);
    const [cls] = toInput(draft).classes;

    expect(cls?.questions).toEqual(["Medo?"]);
    expect(cls?.members.map((m) => [m.target_bp, m.answers])).toEqual([
      [undefined, [false]],
      [undefined, [null]],
    ]);
  });

  it("give an asset that joins no answer", () => {
    const draft = addMember(startEditing(toDraft(view)), 0, {
      instrument: "ASOL11",
    });

    expect(toInput(draft).classes[0]?.members[2]).toEqual({
      instrument: "ASOL11",
      target_bp: 0,
      answers: [null],
      answer_dates: [null],
      answer_overrides: [false],
    });
  });
});
