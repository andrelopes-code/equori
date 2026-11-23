import { describe, expect, it } from "vitest";

import { toInput } from "@/features/portfolio/contribution-plan/model/plan-draft";
import { startEditing } from "@/features/portfolio/contribution-plan/model/plan-edits";
import {
  addRule,
  maxRules,
  removeRule,
  replaceRule,
  setByRule,
} from "@/features/portfolio/contribution-plan/model/rule-edits";

const rate = { instrument_type: "fixed_income", return_kind: "rate" } as const;
const inflation = {
  return_kind: "inflation",
  matures_from_year: 2031,
} as const;
const liquid = { daily_liquidity: true } as const;

const plain = {
  byQuestions: false,
  questions: [],
  questionFacts: [],
  questionLimits: [],
  rules: [],
};

const draft = () =>
  startEditing({
    classes: [
      {
        ...plain,
        name: "Ações",
        targetBp: 6000,
        questions: ["Cresce?"],
        questionFacts: [],
        questionLimits: [],
        byQuestions: true,
        members: [
          { instrument: "PETR4", answers: [true] },
          { instrument: "VALE3", answers: [false] },
        ],
      },
      {
        ...plain,
        name: "Renda fixa",
        targetBp: 4000,
        rules: [rate, inflation],
        members: [],
      },
    ],
  });

describe("rule edits", () => {
  it("starts a group with rules as by rule", () => {
    expect(draft().classes.map((c) => c.byRule)).toEqual([false, true]);
  });

  it("turns a group to by rule dropping members, questions and targets", () => {
    const next = setByRule(draft(), 0, true).classes[0];

    expect(next).toMatchObject({
      byRule: true,
      byQuestions: false,
      split: false,
      questions: [],
      members: [],
      memberLocks: [],
      rules: [],
    });
  });

  it("turns a group back to chosen assets dropping its rules", () => {
    const next = setByRule(draft(), 1, false).classes[1];

    expect(next).toMatchObject({ byRule: false, rules: [], members: [] });
  });

  it("leaves the other groups as they are", () => {
    const before = draft();
    const next = setByRule(before, 0, true);

    expect(next.classes[1]).toBe(before.classes[1]);
  });

  it("adds a rule at the end", () => {
    const next = addRule(draft(), 1, liquid).classes[1]?.rules;

    expect(next).toEqual([rate, inflation, liquid]);
  });

  it("adds no rule past the limit", () => {
    let next = draft();
    for (let i = 0; i < maxRules + 2; i++) next = addRule(next, 1, liquid);

    expect(maxRules).toBe(5);
    expect(next.classes[1]?.rules).toHaveLength(5);
  });

  it("replaces the rule at a position", () => {
    const next = replaceRule(draft(), 1, 0, liquid).classes[1]?.rules;

    expect(next).toEqual([liquid, inflation]);
  });

  it("removes the rule at a position", () => {
    const next = removeRule(draft(), 1, 0).classes[1]?.rules;

    expect(next).toEqual([inflation]);
  });

  it("sends the rules of a group by rule with no members", () => {
    expect(toInput(draft()).classes[1]).toEqual({
      name: "Renda fixa",
      target_bp: 4000,
      members: [],
      rules: [rate, inflation],
    });
  });

  it("sends neither rules nor members for a group by rule with no rule", () => {
    const next = setByRule(draft(), 0, true);

    expect(toInput(next).classes[0]).toEqual({
      name: "Ações",
      target_bp: 6000,
      members: [],
    });
  });
});
