import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  cellAnswer,
  cellPoints,
} from "@/features/portfolio/contribution-plan/criteria/model/cell-answer";

type Group = components["schemas"]["ContributionClass"];

const brl = { amount: 0, currency: "BRL" };
const answered: Group = {
  name: "Ações",
  target_bp: 10000,
  value: brl,
  questions: ["P/L", "Entendo?", "ROE"],
  question_facts: ["price_earnings_max", "", "roe_min"],
  question_limits: ["15", "", "0.12"],
  question_ideals: true,
  question_effects: [],
  question_reviews: [],
  held: false,
  rules: [],
  matched: [],
  members: [
    {
      instrument: "WEGE3",
      value: brl,
      answers: [false, true, false],
      fact_answers: ["no", "none", "yes"],
      fact_details: [
        { value: "33.4", date: "2026-09-30" },
        {},
        { value: "0.31", date: "2026-09-30" },
      ],
    },
    {
      account_id: "acc-1",
      value: brl,
      answers: [true, true, true],
      fact_answers: ["none", "none", "none"],
      fact_details: [{ reason: "no_report" }, {}, { reason: "no_report" }],
    },
  ],
};
const input = {
  answered,
  member: { instrument: "WEGE3" },
  fact: "price_earnings_max",
  limit: "15",
  stored: true,
  complete: true,
};

describe("cellAnswer", () => {
  it("draws the answer equori gives over the stored one", () => {
    expect(cellAnswer(input)).toEqual({
      kind: "automatic",
      yes: false,
      detail: { value: "33.4", date: "2026-09-30" },
    });
  });

  it("finds the criterion by its fact and limit, wherever the draft holds it", () => {
    expect(
      cellAnswer({ ...input, fact: "roe_min", limit: "0.12", stored: false }),
    ).toMatchObject({ kind: "automatic", yes: true });
  });

  it("draws the investor's answer with the reason equori gives none", () => {
    expect(cellAnswer({ ...input, member: { accountId: "acc-1" } })).toEqual({
      kind: "own",
      yes: true,
      reason: "no_report",
    });
  });

  it("draws the investor's answer of an own criterion, without a reason", () => {
    expect(cellAnswer({ ...input, fact: "", limit: "" })).toEqual({
      kind: "own",
      yes: true,
      reason: undefined,
    });
  });

  it.each([
    ["another limit", { limit: "16" }],
    ["a criterion the preview lacks", { fact: "price_book_max" }],
    ["an asset the preview lacks", { member: { instrument: "ITUB4" } }],
    ["no preview", { answered: undefined }],
  ])("waits with %s", (_, change) => {
    expect(cellAnswer({ ...input, ...change })).toEqual({ kind: "pending" });
  });

  it("draws the investor's answer while the limit is missing", () => {
    expect(cellAnswer({ ...input, limit: "", complete: false })).toEqual({
      kind: "own",
      yes: true,
      reason: undefined,
    });
  });
});

describe("cellAnswer without an answer", () => {
  it("is blank with the reason equori gives none", () => {
    expect(
      cellAnswer({ ...input, member: { accountId: "acc-1" }, stored: null }),
    ).toEqual({ kind: "own", yes: null, reason: "no_report" });
  });

  it("draws the answer equori gives over a blank one", () => {
    expect(cellAnswer({ ...input, stored: null })).toMatchObject({
      kind: "automatic",
      yes: false,
    });
  });
});

describe("cellPoints", () => {
  it("is undefined with a blank answer", () => {
    expect(
      cellPoints(
        [
          { kind: "automatic", yes: true, detail: {} },
          { kind: "own", yes: null, reason: "chart" },
        ],
        [null, null],
      ),
    ).toBeUndefined();
  });

  it("does not take a pending cell for a blank one", () => {
    expect(
      cellPoints(
        [{ kind: "automatic", yes: true, detail: {} }, { kind: "pending" }],
        [null, null],
      ),
    ).toBe(1);
  });

  it("counts the answers yes and the stored answer of a pending cell", () => {
    expect(
      cellPoints(
        [
          { kind: "automatic", yes: true, detail: {} },
          { kind: "own", yes: false, reason: undefined },
          { kind: "pending" },
          { kind: "pending" },
        ],
        [false, true, true, false],
      ),
    ).toBe(2);
  });
});
