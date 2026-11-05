import { describe, expect, it } from "vitest";

import { atypicalFence } from "@/features/forecast/atypical-fence";

describe("atypical fence", () => {
  it("sets Tukey's upper fence on the logarithms of the amounts", () => {
    // exp(Q3 + 1.5 × IQR) of the logarithms is 110.43.
    const atypical = atypicalFence([10, 12, 15, 20, 25, 30, 40, 50]);

    expect(atypical(110)).toBe(false);
    expect(atypical(111)).toBe(true);
  });

  it("keeps an amount equal to a uniform history", () => {
    const atypical = atypicalFence(Array.from({ length: 8 }, () => 1000));

    expect(atypical(1000)).toBe(false);
    expect(atypical(1001)).toBe(true);
  });

  it("sets no fence below eight amounts", () => {
    expect(atypicalFence([10, 12, 15, 20, 25, 30, 40])(1_000_000)).toBe(false);
  });
});
