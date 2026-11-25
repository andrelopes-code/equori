import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  addCriteria,
  planInput,
  removeCriterion,
  renewAnswer,
  restore,
  setAnswer,
  setEffect,
  setLimit,
  setReleased,
  setReview,
  setText,
} from "@/features/portfolio/contribution-plan/panel/criteria-edits";

type Plan = components["schemas"]["ContributionPlan"];

const brl = (amount: number) => ({ amount, currency: "BRL" });
const medo = { group: "Cripto", question: "Medo?" };
const index = { group: "Cripto", question: "Fear" };
const abtc = { instrument: "ABTC11" };

const plan = (over: Partial<Plan["classes"][number]> = {}): Plan => ({
  status: "complete",
  total: brl(0),
  revision: 7,
  holds_ignored: false,
  outside: [],
  missing: [],
  classes: [
    {
      name: "Cripto",
      target_bp: 10000,
      value: brl(0),
      questions: ["Medo?", "Fear"],
      question_facts: ["", "crypto_fear_greed_max"],
      question_limits: ["", "25"],
      question_effects: ["hold", "warn"],
      question_reviews: [1, 0],
      question_ideals: false,
      held: true,
      rules: [],
      matched: [],
      members: [
        {
          instrument: "ABTC11",
          target_bp: 6000,
          value: brl(0),
          answers: [false, null],
          answer_dates: ["2026-10-12", null],
          answer_overrides: [false, false],
        },
        {
          instrument: "AETH11",
          target_bp: 4000,
          value: brl(0),
          answers: [null, null],
          answer_dates: [null, null],
          answer_overrides: [false, false],
        },
      ],
      ...over,
    },
  ],
});

const first = (input: ReturnType<typeof planInput> | undefined) =>
  input?.classes[0];

describe("planInput", () => {
  it("names the revision read", () => {
    expect(planInput(plan()).revision).toBe(7);
  });
});

describe("setAnswer", () => {
  it.each([
    ["yes", true, "2026-11-25"],
    ["no", false, "2026-11-25"],
    ["na", null, "2026-11-25"],
  ] as const)(
    "stores %s of an own criterion with its day",
    (answer, yes, day) => {
      const m = first(setAnswer(medo, abtc, answer, "2026-11-25")(plan()))
        ?.members[0];

      expect(m?.answers).toEqual([yes, null]);
      expect(m?.answer_dates).toEqual([day, null]);
      expect(m?.answer_overrides).toEqual([false, false]);
    },
  );

  it("replaces the answer of a fact and gives it back", () => {
    const own = setAnswer(index, abtc, "no", "2026-11-25")(plan());

    expect(first(own)?.members[0]).toMatchObject({
      answers: [false, false],
      answer_dates: ["2026-10-12", "2026-11-25"],
      answer_overrides: [false, true],
    });

    const auto = setAnswer(index, abtc, "auto", "2026-11-25")(plan());

    expect(first(auto)?.members[0]).toMatchObject({
      answers: [false, null],
      answer_dates: ["2026-10-12", null],
      answer_overrides: [false, false],
    });
  });

  it("finds the criterion whatever the letter case and the place", () => {
    const moved = plan({
      questions: ["Fear", "MEDO?"],
      question_facts: ["crypto_fear_greed_max", ""],
    });

    expect(
      first(setAnswer(medo, abtc, "yes", "2026-11-25")(moved))?.members[0]
        ?.answers,
    ).toEqual([false, true]);
  });

  it.each([
    ["the group", { group: "Moedas", question: "Medo?" }, abtc],
    ["the criterion", { group: "Cripto", question: "Outra?" }, abtc],
    ["the asset", medo, { instrument: "XXXX11" }],
  ])("changes nothing without %s", (_, key, member) => {
    expect(setAnswer(key, member, "yes", "2026-11-25")(plan())).toBeUndefined();
  });
});

describe("the other edits of a criterion", () => {
  it("renew the date alone", () => {
    const m = first(renewAnswer(medo, abtc, "2026-11-25")(plan()))?.members[0];

    expect(m?.answers).toEqual([false, null]);
    expect(m?.answer_dates).toEqual(["2026-11-25", null]);
  });

  it("set the text, the reminder, the limit and the release", () => {
    expect(first(setText(medo, "Caiu?")(plan()))?.questions).toEqual([
      "Caiu?",
      "Fear",
    ]);
    expect(first(setReview(medo, 3)(plan()))?.question_reviews).toEqual([3, 0]);
    expect(first(setLimit(index, "")(plan()))?.question_limits).toEqual([
      "",
      "",
    ]);
    expect(first(setLimit(index, "30")(plan()))?.question_limits).toEqual([
      "",
      "30",
    ]);
    expect(
      first(setReleased("Cripto", abtc, true)(plan()))?.members.map(
        (m) => m.released,
      ),
    ).toEqual([true, undefined]);
    expect(
      first(setReleased("Cripto", abtc, false)(plan()))?.members[0]?.released,
    ).toBe(false);
  });

  it("drop the typed ideals when a criterion starts to weigh", () => {
    const cls = first(setEffect(medo, "weigh")(plan()));

    expect(cls?.question_effects).toEqual(["weigh", "warn"]);
    expect(cls?.members.map((m) => m.target_bp)).toEqual([
      undefined,
      undefined,
    ]);
  });

  it("keep the derived ideals as typed when the last one stops", () => {
    const derived = plan({
      question_effects: ["weigh", "warn"],
      question_ideals: true,
    });

    expect(
      first(setEffect(medo, "warn")(derived))?.members.map((m) => m.target_bp),
    ).toEqual([6000, 4000]);
    expect(
      first(removeCriterion(medo)(derived))?.members.map((m) => m.target_bp),
    ).toEqual([6000, 4000]);
  });

  it("leave a group undivided when the criteria gave no ideal", () => {
    const none = plan({
      question_effects: ["weigh", "warn"],
      question_ideals: false,
    });

    expect(
      first(setEffect(medo, "warn")(none))?.members.map((m) => m.target_bp),
    ).toEqual([undefined, undefined]);
  });
});

describe("addCriteria and removeCriterion", () => {
  it("add criteria that only warn, with no answer", () => {
    const cls = first(
      addCriteria("Cripto", [{ text: "Caiu?", fact: "" }])(plan()),
    );

    expect(cls?.questions).toEqual(["Medo?", "Fear", "Caiu?"]);
    expect(cls?.question_effects).toEqual(["hold", "warn", "warn"]);
    expect(cls?.members[0]).toMatchObject({
      answers: [false, null, null],
      answer_dates: ["2026-10-12", null, null],
      target_bp: 6000,
    });
  });

  it("add nothing the group already holds", () => {
    expect(
      addCriteria("Cripto", [
        { text: "medo? ", fact: "" },
        { text: "Outro texto", fact: "crypto_fear_greed_max" },
      ])(plan()),
    ).toBeUndefined();
  });

  it("add the first criterion of a group without any", () => {
    const empty = plan({
      questions: [],
      question_facts: [],
      question_limits: [],
      question_effects: [],
      question_reviews: [],
      members: [{ instrument: "ABTC11", value: brl(0) }],
    });

    expect(
      first(addCriteria("Cripto", [{ text: "Medo?", fact: "" }])(empty)),
    ).toMatchObject({
      questions: ["Medo?"],
      question_effects: ["warn"],
      members: [{ instrument: "ABTC11", answers: [null] }],
    });
  });

  it("remove a criterion from every list", () => {
    const cls = first(removeCriterion(medo)(plan()));

    expect(cls).toMatchObject({
      questions: ["Fear"],
      question_facts: ["crypto_fear_greed_max"],
      question_limits: ["25"],
      question_effects: ["warn"],
    });
    expect(cls?.members[0]?.answers).toEqual([null]);
  });

  it("leave no answer behind the last criterion", () => {
    const one = plan({
      questions: ["Medo?"],
      question_facts: [""],
      question_limits: [""],
      question_effects: ["hold"],
      question_reviews: [1],
      members: [{ instrument: "ABTC11", value: brl(0), answers: [false] }],
    });

    expect(first(removeCriterion(medo)(one))).toEqual({
      name: "Cripto",
      target_bp: 10000,
      members: [{ instrument: "ABTC11" }],
    });
  });
});

describe("restore", () => {
  it("goes back to the plan before, over the revision of the save", () => {
    const saved = { ...plan(), revision: 8 };

    expect(restore(plan(), 8)(saved)).toEqual({
      ...planInput(plan()),
      revision: 8,
    });
  });

  it("is refused after another save", () => {
    expect(restore(plan(), 8)({ ...plan(), revision: 9 })).toBeUndefined();
  });
});
