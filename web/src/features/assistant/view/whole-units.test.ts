import { describe, expect, it } from "vitest";

import { wholeUnits } from "@/features/assistant/view/whole-units";

describe("wholeUnits", () => {
  it("rounds half away from zero", () => {
    expect(wholeUnits(482000, 2)).toBe(4820);
    expect(wholeUnits(902895, 2)).toBe(9029);
    expect(wholeUnits(-819105, 2)).toBe(-8191);
    expect(wholeUnits(-50, 2)).toBe(-1);
    expect(wholeUnits(49, 2)).toBe(0);
  });

  it("keeps a currency without minor units", () => {
    expect(wholeUnits(1500, 0)).toBe(1500);
  });
});
