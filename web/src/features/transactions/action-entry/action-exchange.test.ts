import { describe, expect, it } from "vitest";

import { emptyAction } from "@/features/transactions/action-entry/action-draft";
import {
  costBP,
  exchangeFields,
  exchangeProblems,
} from "@/features/transactions/action-entry/action-exchange";

describe("costBP", () => {
  it.each([
    ["25", 2500],
    ["12,5", 1250],
    ["0.01", 1],
    ["99.99", 9999],
  ])("reads %s as %d basis points", (typed, bp) => {
    expect(costBP(typed)).toBe(bp);
  });

  it.each(["", "0", "100", "12.345", "abc", "-5"])("refuses %s", (typed) => {
    expect(costBP(typed)).toBeNull();
  });
});

describe("exchange fields", () => {
  const spinOff = {
    ...emptyAction("2026-11-10"),
    kind: "spin_off" as const,
    newInstrument: "nova3",
    costPercent: "25",
  };

  it("sends the code received and the cost of a spin-off", () => {
    expect(exchangeFields(spinOff, "BRL")).toEqual({
      new_instrument: "NOVA3",
      cost_bp: 2500,
    });
    expect(exchangeProblems(spinOff)).toEqual({});
  });

  it("names the missing fields", () => {
    expect(
      exchangeProblems({ ...spinOff, newInstrument: "", costPercent: "" }),
    ).toEqual({
      new_instrument: "action.required.newInstrument",
      cost_bp: "action.required.costPercent",
    });
    expect(
      exchangeProblems({ ...spinOff, kind: "conversion", costPercent: "" }),
    ).toEqual({});
  });

  it("adds nothing to another kind", () => {
    expect(exchangeFields({ ...spinOff, kind: "split" }, "BRL")).toEqual({});
    expect(exchangeProblems({ ...spinOff, kind: "split" })).toEqual({});
  });

  // Coverage row E-06: a right issue takes the code of the right; an exercise adds the price paid.
  it("sends the price an exercise pays and no cost share", () => {
    const exercise = {
      ...spinOff,
      kind: "right_exercise" as const,
      newInstrument: "petr10",
      amount: 8000,
    };

    expect(exchangeFields(exercise, "BRL")).toEqual({
      new_instrument: "PETR10",
      amount: { amount: 8000, currency: "BRL" },
    });
    expect(exchangeProblems(exercise)).toEqual({});
    expect(exchangeProblems({ ...exercise, amount: 0 })).toEqual({
      amount: "entry.required.amount",
    });
    expect(exchangeFields({ ...exercise, kind: "right_issue" }, "BRL")).toEqual(
      { new_instrument: "PETR10" },
    );
  });
});
