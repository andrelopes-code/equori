import { describe, expect, it } from "vitest";

import {
  bpText,
  formatPercentBp,
  parsePercentBp,
} from "@/features/instruments/basis-points";

describe("parsePercentBp", () => {
  it.each([
    ["110", 11000],
    ["110,5", 11050],
    ["6", 600],
    ["0.05", 5],
    ["0", 0],
    [" 12.34 ", 1234],
  ])("reads %s as %i basis points", (text, bp) => {
    expect(parsePercentBp(text)).toBe(bp);
  });

  it.each(["", "abc", "-1", "1.234", "1,2,3", "1e2"])("refuses %s", (text) => {
    expect(parsePercentBp(text)).toBeNull();
  });
});

describe("bpText", () => {
  it.each([
    [11000, "110"],
    [11050, "110.5"],
    [5, "0.05"],
    [600, "6"],
    [0, "0"],
  ])("writes %i as %s", (bp, text) => {
    expect(bpText(bp)).toBe(text);
  });
});

describe("formatPercentBp", () => {
  it("writes a percent in the locale", () => {
    expect(formatPercentBp(11000, "en-US")).toBe("110%");
    expect(formatPercentBp(1050, "pt-BR")).toBe("10,5%");
  });
});
