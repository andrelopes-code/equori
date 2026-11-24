import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  boardOf,
  equalShares,
} from "@/features/portfolio/contribution-plan/criteria/model/board-rows";
import type { EditClass } from "@/features/portfolio/contribution-plan/model/plan-edits";

type Group = components["schemas"]["ContributionClass"];

const brl = { amount: 0, currency: "BRL" };
const edit: EditClass = {
  name: "Ações",
  targetBp: 10000,
  byQuestions: true,
  questions: ["Entendo?", "P/L", "P/VP"],
  questionFacts: ["", "price_earnings_max", "price_book_max"],
  questionLimits: ["", "15", ""],
  members: [
    { instrument: "WEGE3", answers: [true, false, true] },
    { accountId: "acc-1", answers: [false, true, false] },
  ],
  rules: [],
  locked: false,
  split: true,
  byRule: false,
  memberLocks: [false, false],
};
const answered: Group = {
  name: "Ações",
  target_bp: 10000,
  value: brl,
  questions: ["Entendo?", "P/L"],
  question_facts: ["", "price_earnings_max"],
  question_limits: ["", "15"],
  question_ideals: true,
  rules: [],
  matched: [],
  members: [
    {
      instrument: "WEGE3",
      value: brl,
      target_bp: 5000,
      fact_answers: ["none", "no"],
      fact_details: [{}, { value: "33.4", date: "2026-09-30" }],
    },
    {
      account_id: "acc-1",
      value: brl,
      target_bp: 5000,
      fact_answers: ["none", "none"],
      fact_details: [{}, { reason: "no_report" }],
    },
  ],
};
const name = (ref: { account_id?: string; instrument?: string }) =>
  ref.instrument ?? "Reserva";

describe("boardOf", () => {
  it("draws each criterion with its state", () => {
    expect(boardOf(edit, answered, name).rows).toEqual([
      { text: "Entendo?", fact: "", limit: "", state: "ok" },
      { text: "P/L", fact: "price_earnings_max", limit: "15", state: "ok" },
      { text: "P/VP", fact: "price_book_max", limit: "", state: "noLimit" },
    ]);
  });

  it("gives each asset its cells, points and derived ideal", () => {
    const { assets } = boardOf(edit, answered, name);

    expect(assets.map((a) => [a.name, a.points, a.ideal])).toEqual([
      ["WEGE3", 2, 0.5],
      ["Reserva", 1, 0.5],
    ]);
    expect(assets[0]?.cells.map((c) => c.kind)).toEqual([
      "own",
      "automatic",
      "own",
    ]);
  });

  it("gives no ideal without a yes or before the preview", () => {
    const none = { ...answered, question_ideals: false };

    expect(boardOf(edit, none, name).assets[0]?.ideal).toBeUndefined();
    expect(boardOf(edit, undefined, name).assets[0]?.ideal).toBeUndefined();
  });
});

describe("equalShares", () => {
  const blank = {
    ...edit,
    members: [
      { instrument: "WEGE3", answers: [true, null, true] },
      { accountId: "acc-1", answers: [false, null, false] },
    ],
  };

  it("names the assets with a blank answer, which have no points", () => {
    const { assets } = boardOf(blank, answered, name);

    expect(assets.map((a) => a.points)).toEqual([2, undefined]);
    expect(equalShares(assets)).toEqual(["Reserva"]);
  });

  it("names none when every asset has its answers", () => {
    expect(equalShares(boardOf(edit, answered, name).assets)).toEqual([]);
  });
});
