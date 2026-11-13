import { describe, expect, it } from "vitest";

import {
  formatPercent,
  parsePercent,
} from "@/features/portfolio/contribution-plan/editor/target-percent";

describe("parsePercent", () => {
  it.each([
    ["30", 3000],
    ["17.5", 1750],
    ["17,5", 1750],
    ["0", 0],
    ["100", 10000],
    ["33.33", 3330],
    ["0.05", 10],
    [" 12 ", 1200],
  ])("reads %j as %i basis points", (text, bp) => {
    expect(parsePercent(text)).toBe(bp);
  });

  it.each(["", "  ", "abc", "-1", "100.1", "Infinity"])(
    "rejects %j",
    (text) => {
      expect(parsePercent(text)).toBeUndefined();
    },
  );
});

describe("formatPercent", () => {
  it.each([
    ["en-US", 1750, "17.5"],
    ["pt-BR", 1750, "17,5"],
    ["en-US", 0, "0.0"],
    ["en-US", 10000, "100.0"],
  ])("formats %s %i as %s", (tag, bp, text) => {
    expect(formatPercent(tag, bp)).toBe(text);
  });
});
