import { describe, expect, it } from "vitest";

import { startEditing } from "@/features/portfolio/contribution-plan/model/plan-edits";
import {
  addQuestion,
  removeQuestion,
  setAnswer,
  setByQuestions,
} from "@/features/portfolio/contribution-plan/model/question-edits";

const draft = () =>
  startEditing({
    classes: [
      {
        name: "Stocks",
        targetBp: 10000,
        byQuestions: false,
        questions: [],
        members: [
          { instrument: "PETR4", targetBp: 5000 },
          { instrument: "VALE3", targetBp: 5000 },
        ],
      },
    ],
  });

const answered = () =>
  setAnswer(
    addQuestion(addQuestion(setByQuestions(draft(), 0, true), 0), 0),
    0,
    0,
    1,
    true,
  );

describe("question edits", () => {
  it("adds questions and sets an answer", () => {
    const cls = answered().classes[0];

    expect(cls?.byQuestions).toBe(true);
    expect(cls?.split).toBe(true);
    expect(cls?.questions).toEqual(["", ""]);
    expect(cls?.members).toEqual([
      { instrument: "PETR4", answers: [false, true] },
      { instrument: "VALE3", answers: [false, false] },
    ]);
  });

  it("removes a question and its answer from every member", () => {
    const cls = removeQuestion(answered(), 0, 0).classes[0];

    expect(cls?.questions).toEqual([""]);
    expect(cls?.members).toEqual([
      { instrument: "PETR4", answers: [true] },
      { instrument: "VALE3", answers: [false] },
    ]);
  });

  it("adds no question at ten", () => {
    let next = setByQuestions(draft(), 0, true);
    for (let i = 0; i < 10; i++) next = addQuestion(next, 0);

    expect(addQuestion(next, 0)).toBe(next);
    expect(next.classes[0]?.questions).toHaveLength(10);
  });

  it("keeps the derived targets when it goes back to typed", () => {
    const off = setByQuestions(answered(), 0, false, [6667, 3333]).classes[0];

    expect(off?.byQuestions).toBe(false);
    expect(off?.questions).toEqual([]);
    expect(off?.members).toEqual([
      { instrument: "PETR4", targetBp: 6667 },
      { instrument: "VALE3", targetBp: 3333 },
    ]);
  });

  it("gives equal shares without derived targets", () => {
    const off = setByQuestions(answered(), 0, false).classes[0];

    expect(off?.members.map((m) => m.targetBp)).toEqual([5000, 5000]);
  });
});
