import { describe, expect, it } from "vitest";

import { startEditing } from "@/features/portfolio/contribution-plan/model/plan-edits";
import {
  addFactQuestions,
  addQuestion,
  removeQuestion,
  setAnswer,
  setByQuestions,
  setQuestionLimit,
} from "@/features/portfolio/contribution-plan/model/question-edits";

const draft = () =>
  startEditing({
    classes: [
      {
        name: "Stocks",
        targetBp: 10000,
        byQuestions: false,
        questions: [],
        questionFacts: [],
        questionLimits: [],
        rules: [],
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

  it("adds no question at twenty", () => {
    let next = setByQuestions(draft(), 0, true);
    for (let i = 0; i < 20; i++) next = addQuestion(next, 0);

    expect(addQuestion(next, 0)).toBe(next);
    expect(next.classes[0]?.questions).toHaveLength(20);
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

  it("appends an empty fact with a question and removes the fact of a removed question", () => {
    const added = answered().classes[0];
    expect(added?.questionFacts).toEqual(["", ""]);
    expect(added?.questionLimits).toEqual(["", ""]);

    const three = addQuestion(answered(), 0);
    const withFacts = {
      ...three,
      classes: three.classes.map((cls) => ({
        ...cls,
        questionFacts: ["f1", "f2", "f3"],
        questionLimits: ["1", "2", "3"],
      })),
    };
    const removed = removeQuestion(withFacts, 0, 1).classes[0];

    expect(removed?.questionFacts).toEqual(["f1", "f3"]);
    expect(removed?.questionLimits).toEqual(["1", "3"]);
  });

  it("sets the limit of one question", () => {
    const set = setQuestionLimit(answered(), 0, 1, "0.12").classes[0];

    expect(set?.questionLimits).toEqual(["", "0.12"]);
  });
});

describe("addFactQuestions", () => {
  const nine = Array.from({ length: 9 }, (_, i) => ({
    fact: `piotroski_p${String(i + 1)}`,
    text: `Text ${String(i + 1)}`,
  }));

  it("appends one question per entry with a blank answer per member", () => {
    const cls = addFactQuestions(draft(), 0, nine).classes[0];

    expect(cls?.questions).toEqual(nine.map((f) => f.text));
    expect(cls?.questionFacts).toEqual(nine.map((f) => f.fact));
    expect(cls?.questionLimits).toEqual(Array<string>(9).fill(""));
    expect(cls?.members.map((m) => m.answers)).toEqual([
      Array<null>(9).fill(null),
      Array<null>(9).fill(null),
    ]);
  });

  it("keeps the one own question, ten in all", () => {
    const one = addQuestion(draft(), 0);
    const cls = addFactQuestions(one, 0, nine).classes[0];

    expect(cls?.questions).toHaveLength(10);
    expect(cls?.questionFacts[0]).toBe("");
  });

  it("returns the draft unchanged past twenty questions", () => {
    let twelve = draft();
    for (let i = 0; i < 12; i++) twelve = addQuestion(twelve, 0);

    expect(addFactQuestions(twelve, 0, nine)).toBe(twelve);
  });

  it("skips a fact the class names", () => {
    const named = addFactQuestions(draft(), 0, nine.slice(0, 1));
    const all = addFactQuestions(named, 0, nine).classes[0];

    expect(all?.questionFacts).toEqual(nine.map((f) => f.fact));
    expect(addFactQuestions(named, 0, nine.slice(0, 1))).toBe(named);
  });
});
