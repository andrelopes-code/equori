import { describe, expect, it } from "vitest";

import {
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

  it("leaves blank what neither the filings nor the investor answer", () => {
    expect(effectiveAnswers([null, null], ["yes", "none"])).toEqual([
      true,
      null,
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

describe("piotroskiFacts", () => {
  it("holds the nine keys from p1 to p9", () => {
    expect(piotroskiFacts).toHaveLength(9);
    expect(piotroskiFacts[0]).toBe("piotroski_p1");
    expect(piotroskiFacts[8]).toBe("piotroski_p9");
  });
});
