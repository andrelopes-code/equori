import { describe, expect, it } from "vitest";

import { figureText } from "@/features/portfolio/contribution-plan/criteria/model/figure-text";

describe("figureText", () => {
  it.each([
    ["times", "33.405712", "33,4"],
    ["times", "0.438574", "0,44"],
    ["times", "-0.12098", "−0,12"],
    ["percent", "0.203179", "20,3%"],
    ["percent", "2.1748", "217%"],
    ["percent", "-0.05", "−5%"],
    ["years", "5", "5"],
  ] as const)("writes a figure in %s: %s", (unit, value, text) => {
    expect(figureText("pt-BR", unit, value)).toBe(text);
  });
});
