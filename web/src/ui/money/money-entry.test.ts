import { describe, expect, it } from "vitest";

import { caretBefore, minorFromTyped, moneyEdit } from "@/ui/money/money-entry";

describe("minorFromTyped", () => {
  it.each([
    ["", 0],
    ["1", 1],
    ["1234", 1234],
    ["R$ 12,34", 1234],
    ["1.234,56", 123_456],
    ["0007", 7],
  ])("reads %j as %i minor units", (text, minor) => {
    expect(minorFromTyped(text, 12)).toBe(minor);
  });

  it("keeps the digits up to the limit", () => {
    expect(minorFromTyped("12345", 4)).toBe(1234);
  });
});

describe("moneyEdit", () => {
  it.each([
    ["1.000,00", "15.000,00", 2, false, "15", "00000"],
    ["10.000,00", "0.000,00", 0, false, "", "000000"],
    ["12.345,67", "12345,67", 2, false, "1", "34567"],
    ["12.345,67", "12345,67", 2, true, "12", "4567"],
    ["0,00", "0,005", 5, false, "5", ""],
    ["1.000,00", "1.000a,00", 6, false, "1000", "00"],
  ])(
    "reads %j edited to %j at %i (forward: %s)",
    (before, after, caret, forward, head, tail) => {
      expect(moneyEdit(before, after, caret, forward, 15)).toEqual({
        head,
        tail,
      });
    },
  );

  it("refuses a digit past the limit and keeps the ones on the right", () => {
    expect(moneyEdit("12,34", "129,34", 3, false, 4)).toEqual({
      head: "12",
      tail: "34",
    });
  });
});

describe("caretBefore", () => {
  it.each([
    ["10.000,00", 0, 9],
    ["10.000,00", 2, 6],
    ["10.000,00", 5, 2],
    ["10.000,00", 7, 0],
  ])("leaves in %j %i digits on the right at %i", (text, digits, caret) => {
    expect(caretBefore(text, digits)).toBe(caret);
  });
});
