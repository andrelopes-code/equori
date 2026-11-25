import { describe, expect, it } from "vitest";

import {
  counts,
  derivesIdeals,
  effectOf,
} from "@/features/portfolio/contribution-plan/criteria/model/criterion-effect";

const own = { questions: ["Medo?"] };
const limited = {
  questions: ["P/L"],
  question_facts: ["price_earnings_max"],
  question_limits: [""],
};

describe("criterion effect", () => {
  it("weighs when the effect is absent (CO1)", () => {
    expect(effectOf(own, 0)).toBe("weigh");
    expect(effectOf({ ...own, question_effects: ["hold"] }, 0)).toBe("hold");
  });

  it("does not count without the limit it needs (CO2)", () => {
    expect(counts(limited, 0)).toBe(false);
    expect(counts({ ...limited, question_limits: ["15"] }, 0)).toBe(true);
    expect(counts(own, 0)).toBe(true);
  });

  it.each([
    ["an own criterion", own, true],
    ["one that holds", { ...own, question_effects: ["hold" as const] }, false],
    ["one without its limit", limited, false],
    ["none", { questions: [] }, false],
  ])("derives the ideals with %s: %s", (_, cls, want) => {
    expect(derivesIdeals(cls)).toBe(want);
  });
});
