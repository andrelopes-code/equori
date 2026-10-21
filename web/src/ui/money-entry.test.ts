import { describe, expect, it } from "vitest";

import { minorFromTyped } from "@/ui/money-entry";

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
