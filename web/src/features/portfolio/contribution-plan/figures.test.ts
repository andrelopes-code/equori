import { describe, expect, it } from "vitest";

import {
  formatShare,
  isPositive,
  noValue,
} from "@/features/portfolio/contribution-plan/figures";

describe("formatShare", () => {
  it.each([
    { bp: 557, tag: "pt-BR", want: "5,6%" },
    { bp: 2000, tag: "pt-BR", want: "20%" },
    { bp: 1818, tag: "en-US", want: "18.2%" },
    { bp: undefined, tag: "en-US", want: noValue },
  ])("writes $bp in $tag as $want", ({ bp, tag, want }) => {
    expect(formatShare(tag, bp)).toBe(want);
  });
});

describe("isPositive", () => {
  it("accepts only an amount above zero", () => {
    expect(isPositive({ amount: 1, currency: "BRL" })).toBe(true);
    expect(isPositive({ amount: 0, currency: "BRL" })).toBe(false);
    expect(isPositive(undefined)).toBe(false);
  });
});
