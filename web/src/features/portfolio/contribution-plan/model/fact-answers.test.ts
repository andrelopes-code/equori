import { describe, expect, it } from "vitest";

import {
  canUseMethod,
  effectiveAnswers,
  factDecides,
  piotroskiFacts,
} from "@/features/portfolio/contribution-plan/model/fact-answers";

describe("effectiveAnswers", () => {
  it("takes the fact where the filings decide and the investor's answer else", () => {
    expect(effectiveAnswers([false, true], ["yes", "none"])).toEqual([
      true,
      true,
    ]);
  });

  it("lets a fact no override a stored sim", () => {
    expect(effectiveAnswers([true, true], ["no", "none"])).toEqual([
      false,
      true,
    ]);
  });

  it("returns the answers without facts", () => {
    expect(effectiveAnswers([true, false], undefined)).toEqual([true, false]);
  });
});

describe("factDecides", () => {
  it("is true for yes and no, false for none and for no facts", () => {
    expect(factDecides(["yes", "none"], 0)).toBe(true);
    expect(factDecides(["yes", "none"], 1)).toBe(false);
    expect(factDecides(undefined, 0)).toBe(false);
  });
});

describe("canUseMethod", () => {
  it("is offered while no fact is named and at most one question exists", () => {
    expect(canUseMethod([], [])).toBe(true);
    expect(canUseMethod(["a"], [""])).toBe(true);
    expect(canUseMethod(["a", "b"], ["", ""])).toBe(false);
    expect(canUseMethod(["x"], ["piotroski_p1"])).toBe(false);
  });
});

describe("piotroskiFacts", () => {
  it("holds the nine keys from p1 to p9", () => {
    expect(piotroskiFacts).toHaveLength(9);
    expect(piotroskiFacts[0]).toBe("piotroski_p1");
    expect(piotroskiFacts[8]).toBe("piotroski_p9");
  });
});
