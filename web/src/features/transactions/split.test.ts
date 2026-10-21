import { describe, expect, it } from "vitest";

import {
  majorFromMinor,
  minorFromMajor,
  splitState,
} from "@/features/transactions/split";

describe("minor and major units", () => {
  it("converts through the decimal text, never by division", () => {
    expect(minorFromMajor(0.1 + 0.2, 2)).toBe(30);
    expect(minorFromMajor(123.45, 2)).toBe(12345);
    expect(minorFromMajor(-7, 2)).toBe(-700);
    expect(minorFromMajor(5, 0)).toBe(5);
    expect(majorFromMinor(12345, 2)).toBe(123.45);
    expect(majorFromMinor(-5, 2)).toBe(-0.05);
    expect(majorFromMinor(700, 0)).toBe(700);
  });
});

describe("splitState", () => {
  it("states what remains of the total and whether the parts can be sent", () => {
    expect(
      splitState(15000, [
        { categoryId: "food", amount: 10000 },
        { categoryId: "fun", amount: 3000 },
      ]),
    ).toEqual({ remaining: 2000, ready: false });
    expect(
      splitState(15000, [
        { categoryId: "food", amount: 10000 },
        { categoryId: "fun", amount: 5000 },
      ]),
    ).toEqual({ remaining: 0, ready: true });
  });

  it("refuses a part without a category, a zero part and a repeated category", () => {
    expect(splitState(100, [{ categoryId: null, amount: 100 }]).ready).toBe(
      false,
    );
    expect(
      splitState(100, [
        { categoryId: "a", amount: 100 },
        { categoryId: "b", amount: 0 },
      ]).ready,
    ).toBe(false);
    expect(
      splitState(100, [
        { categoryId: "a", amount: 50 },
        { categoryId: "a", amount: 50 },
      ]).ready,
    ).toBe(false);
  });
});
