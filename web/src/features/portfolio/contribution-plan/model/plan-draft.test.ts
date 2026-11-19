import { describe, expect, it } from "vitest";

import {
  toDraft,
  toInput,
} from "@/features/portfolio/contribution-plan/model/plan-draft";
import type { components } from "@/api/schema.gen";

type Plan = components["schemas"]["ContributionPlan"];

const brl = (amount: number) => ({ amount, currency: "BRL" });

// S398: a saved plan with an instrument member, an account member and an empty class.
const saved: Plan = {
  status: "complete",
  total: brl(1000000),
  drift_bp: 120,
  classes: [
    {
      name: "Stocks",
      target_bp: 6000,
      value: brl(600000),
      share_bp: 6000,
      questions: [],
      question_ideals: false,
      rules: [],
      matched: [],
      members: [
        {
          instrument: "PETR4",
          target_bp: 7000,
          value: brl(400000),
          share_bp: 4000,
          unit_value: brl(4000),
        },
        {
          account_id: "7f1b2c3d-0000-4000-8000-000000000001",
          target_bp: 3000,
          value: brl(200000),
          share_bp: 2000,
        },
      ],
    },
    {
      name: "Cash",
      target_bp: 4000,
      value: brl(400000),
      share_bp: 4000,
      questions: [],
      question_ideals: false,
      rules: [],
      matched: [],
      members: [],
    },
  ],
  outside: [],
  missing: [],
};

describe("plan draft", () => {
  it("converts a view to a draft without the computed fields", () => {
    const got = toDraft(saved);

    expect(got).toEqual({
      classes: [
        {
          name: "Stocks",
          targetBp: 6000,
          byQuestions: false,
          questions: [],
          members: [
            { instrument: "PETR4", targetBp: 7000 },
            {
              accountId: "7f1b2c3d-0000-4000-8000-000000000001",
              targetBp: 3000,
            },
          ],
        },
        {
          name: "Cash",
          targetBp: 4000,
          byQuestions: false,
          questions: [],
          members: [],
        },
      ],
    });
  });

  it("keeps the amount in the draft", () => {
    const got = toDraft({ ...saved, amount: brl(150000) });

    expect(got.amount).toEqual(brl(150000));
  });

  it("round-trips the S398 shape to the input body", () => {
    const got = toInput(toDraft({ ...saved, amount: brl(150000) }));

    expect(got).toEqual({
      amount: brl(150000),
      classes: [
        {
          name: "Stocks",
          target_bp: 6000,
          members: [
            { instrument: "PETR4", target_bp: 7000 },
            {
              account_id: "7f1b2c3d-0000-4000-8000-000000000001",
              target_bp: 3000,
            },
          ],
        },
        { name: "Cash", target_bp: 4000, members: [] },
      ],
    });
  });

  it("omits the amount and the member target when absent", () => {
    const got = toInput({
      classes: [
        {
          name: "A",
          targetBp: 10000,
          byQuestions: false,
          questions: [],
          members: [{ instrument: "X" }],
        },
      ],
    });

    expect(got).toEqual({
      classes: [
        { name: "A", target_bp: 10000, members: [{ instrument: "X" }] },
      ],
    });
  });

  it("reads the questions and the answers of a class", () => {
    const got = toDraft({
      ...saved,
      classes: [
        {
          name: "Stocks",
          target_bp: 10000,
          value: brl(0),
          share_bp: 0,
          questions: ["Q1"],
          question_ideals: true,
          rules: [],
          matched: [],
          members: [
            {
              instrument: "PETR4",
              target_bp: 10000,
              answers: [true],
              value: brl(0),
              share_bp: 0,
            },
          ],
        },
      ],
    });

    expect(got.classes[0]).toEqual({
      name: "Stocks",
      targetBp: 10000,
      byQuestions: true,
      questions: ["Q1"],
      members: [{ instrument: "PETR4", targetBp: 10000, answers: [true] }],
    });
  });

  it("sends the questions and the answers, without a member target", () => {
    const got = toInput({
      classes: [
        {
          name: "A",
          targetBp: 10000,
          byQuestions: true,
          questions: ["Q1", "Q2"],
          members: [
            { instrument: "X", targetBp: 5000, answers: [true, false] },
            { instrument: "Y", answers: [false, false] },
          ],
        },
      ],
    });

    expect(got).toEqual({
      classes: [
        {
          name: "A",
          target_bp: 10000,
          questions: ["Q1", "Q2"],
          members: [
            { instrument: "X", answers: [true, false] },
            { instrument: "Y", answers: [false, false] },
          ],
        },
      ],
    });
  });

  it("sends neither questions, answers nor member target without a question", () => {
    const got = toInput({
      classes: [
        {
          name: "A",
          targetBp: 10000,
          byQuestions: true,
          questions: [],
          members: [{ instrument: "X", targetBp: 5000, answers: [] }],
        },
      ],
    });

    expect(got).toEqual({
      classes: [
        { name: "A", target_bp: 10000, members: [{ instrument: "X" }] },
      ],
    });
  });
});
