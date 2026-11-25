import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  type CriterionView,
  answerCounts,
  answerOf,
  criteriaOf,
  effectiveAnswer,
  pointsOf,
} from "@/features/portfolio/contribution-plan/panel/criterion-view";
import { catalogPtBR } from "@/i18n/catalog.pt-BR";
import type { TFunction } from "@/i18n/i18n-provider";

type Group = components["schemas"]["ContributionClass"];
type Member = Group["members"][number];

const t = ((key) => catalogPtBR[key]) satisfies TFunction;
const brl = { amount: 0, currency: "BRL" };
const own: CriterionView = {
  position: 0,
  question: "Medo?",
  text: "Medo?",
  fact: "",
  limit: "",
  effect: "weigh",
  review: 0,
  counts: true,
};
const fact: CriterionView = {
  ...own,
  position: 1,
  question: "P/L",
  text: "P/L de até",
  fact: "price_earnings_max",
  limit: "15",
};
const member = (over: Partial<Member> = {}): Member => ({
  instrument: "WEGE3",
  value: brl,
  answers: [null, null],
  answer_dates: [null, null],
  answer_overrides: [false, false],
  fact_answers: ["none", "none"],
  fact_details: [{}, { reason: "shares" }],
  ...over,
});
const answer = (m: Member, c: CriterionView) => effectiveAnswer(answerOf(m, c));

describe("criteriaOf", () => {
  it("reads each criterion with its defaults", () => {
    const cls = {
      questions: ["Medo?", "P/L"],
      question_facts: ["", "price_earnings_max"],
      question_limits: ["", ""],
      question_effects: ["hold"],
      question_reviews: [1],
    } as unknown as Group;

    expect(criteriaOf(t, cls)).toMatchObject([
      { text: "Medo?", effect: "hold", review: 1, counts: true },
      { text: "P/L de até", effect: "weigh", review: 0, counts: false },
    ]);
  });
});

describe("answerOf", () => {
  it.each([
    ["no answer", member(), undefined],
    ["yes", member({ answers: [true, null] }), "yes"],
    ["no, given before the dates", member({ answers: [false, null] }), "no"],
    ["set aside", member({ answer_dates: ["2026-11-01", null] }), "na"],
  ])("reads %s of an own criterion", (_, m, want) => {
    expect(answerOf(m, own).own).toBe(want);
    expect(answer(m, own)).toBe(want);
  });

  it.each([
    ["the answer of equori", { fact_answers: ["none", "yes"] }, "yes"],
    ["none", {}, undefined],
    ["the fallback where equori has none", { answers: [null, false] }, "no"],
    [
      "equori over the fallback",
      { answers: [null, false], fact_answers: ["none", "yes"] },
      "yes",
    ],
    [
      "the override over equori",
      {
        answers: [null, false],
        fact_answers: ["none", "yes"],
        answer_overrides: [false, true],
      },
      "no",
    ],
    [
      "an override that sets it aside",
      {
        fact_answers: ["none", "no"],
        answer_overrides: [false, true],
        answer_dates: [null, "2026-11-25"],
      },
      "na",
    ],
  ])("counts %s of an automatic one (CO4)", (_, over, want) => {
    expect(answer(member(over as Partial<Member>), fact)).toBe(want);
  });

  it("says when the answer is due", () => {
    expect(answerOf(member({ due: [0] }), own).due).toBe(true);
    expect(answerOf(member({ due: [1] }), own).due).toBe(false);
  });
});

describe("pointsOf", () => {
  it("counts the yes of the criteria that weigh (CO5)", () => {
    const m = member({ answers: [true, null], fact_answers: ["none", "no"] });

    expect(pointsOf(m, [own, fact])).toEqual({ yes: 1, count: 2 });
    expect(pointsOf(m, [{ ...own, effect: "hold" }, fact])).toEqual({
      yes: 0,
      count: 1,
    });
    expect(pointsOf(m, [own, { ...fact, counts: false }])).toEqual({
      yes: 1,
      count: 1,
    });
  });

  it("gives no point to an own criterion without an answer", () => {
    const m = member({ fact_answers: ["none", "yes"] });

    expect(pointsOf(m, [own, fact])).toEqual({ yes: 1, count: 2 });
  });

  it("has none while an automatic one has no answer", () => {
    expect(pointsOf(member(), [fact])).toBeUndefined();
    expect(
      pointsOf(member({ answer_overrides: [false, true] }), [fact]),
    ).toEqual({ yes: 0, count: 1 });
  });
});

describe("answerCounts", () => {
  it("counts the answers of the group, one set aside in none of them", () => {
    const cls = {
      members: [
        member({ answers: [true, null] }),
        member({ answers: [false, null] }),
        member(),
        member({ answer_dates: ["2026-11-01", null] }),
      ],
    } as unknown as Group;

    expect(answerCounts(cls, own)).toEqual({ yes: 1, no: 1, none: 1 });
  });
});
