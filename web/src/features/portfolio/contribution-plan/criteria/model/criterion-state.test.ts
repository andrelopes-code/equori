import { describe, expect, it } from "vitest";

import {
  criterionStates,
  incompleteCriteria,
  withoutIncomplete,
} from "@/features/portfolio/contribution-plan/criteria/model/criterion-state";
import type { ClassDraft } from "@/features/portfolio/contribution-plan/model/plan-draft";

const cls: ClassDraft = {
  name: "Ações",
  targetBp: 10000,
  byQuestions: true,
  questions: [
    "Entendo?",
    " ",
    "entendo? ",
    "P/L de até",
    "ROE",
    "ROA positivo",
  ],
  questionFacts: ["", "", "", "price_earnings_max", "roe_min", "piotroski_p1"],
  questionLimits: ["", "", "", "", "0.12", ""],
  members: [
    { instrument: "WEGE3", answers: [true, false, true, false, true, false] },
    { accountId: "a" },
  ],
  rules: [],
};

describe("criterionStates", () => {
  it("names what each criterion lacks", () => {
    expect(criterionStates(cls)).toEqual([
      "ok",
      "blank",
      "repeated",
      "noLimit",
      "ok",
      "ok",
    ]);
  });

  it("reads a limit out of its range as missing", () => {
    expect(
      criterionStates({
        ...cls,
        questions: ["P/L"],
        questionFacts: ["price_earnings_max"],
        questionLimits: ["0"],
      }),
    ).toEqual(["noLimit"]);
  });
});

describe("incompleteCriteria", () => {
  it("counts the criteria of the classes divided by criteria", () => {
    expect(incompleteCriteria([cls, cls])).toBe(6);
    expect(incompleteCriteria([{ ...cls, byQuestions: false }])).toBe(0);
  });
});

describe("withoutIncomplete", () => {
  it("drops an incomplete criterion and its answers", () => {
    const kept = withoutIncomplete(cls);

    expect(kept.questions).toEqual(["Entendo?", "ROE", "ROA positivo"]);
    expect(kept.questionFacts).toEqual(["", "roe_min", "piotroski_p1"]);
    expect(kept.questionLimits).toEqual(["", "0.12", ""]);
    expect(kept.members).toEqual([
      { instrument: "WEGE3", answers: [true, true, false] },
      { accountId: "a" },
    ]);
  });

  it("returns the class when every criterion is complete", () => {
    const whole = {
      ...cls,
      questions: ["A"],
      questionFacts: [""],
      questionLimits: [""],
    };

    expect(withoutIncomplete(whole)).toBe(whole);
  });
});
