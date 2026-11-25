import { describe, expect, it } from "vitest";

import {
  basisAfter,
  gainShare,
  grossOf,
} from "@/features/portfolio/projection/model/gain-tax";

describe("gainShare", () => {
  it.each([
    { value: 1000, basis: 400, share: 0.6 },
    { value: 1000, basis: 1200, share: 0 },
    { value: 0, basis: 100, share: 0 },
  ])(
    "of $value over a basis of $basis is $share",
    ({ value, basis, share }) => {
      expect(gainShare(value, basis)).toBeCloseTo(share, 12);
    },
  );
});

describe("grossOf", () => {
  it("PX14: adds the tax on the gain share to the income", () => {
    // 900 / (1 - 0.2 * 0.5) = 1000.
    expect(grossOf(900, 0.5, 0.2)).toBeCloseTo(1000, 9);
    expect(grossOf(900, 0, 0.2)).toBe(900);
  });
});

describe("basisAfter", () => {
  it("falls with inflation and rises with each contribution", () => {
    // 1000 / 1.25 + 100 = 900; 900 / 1.25 + 100 = 820.
    expect(
      basisAfter(1000, 0.25, [{ contribution: 100 }, { contribution: 100 }]),
    ).toBeCloseTo(820, 9);
  });
});
