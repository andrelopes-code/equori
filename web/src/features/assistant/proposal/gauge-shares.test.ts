import { describe, expect, it } from "vitest";

import { gaugeShares } from "@/features/assistant/proposal/gauge-shares";

describe("gaugeShares", () => {
  it("fills the current limit and hatches the increase", () => {
    const shares = gaugeShares("8000.00", "12000.00");

    expect(shares.current).toBeCloseTo(66.6667, 3);
    expect(shares.changeStart).toBeCloseTo(66.6667, 3);
  });

  it("hatches a decrease from the requested limit to the current one", () => {
    expect(gaugeShares("12000.00", "3000.00")).toEqual({
      current: 100,
      changeStart: 25,
    });
  });

  it("draws an empty track for two zero limits", () => {
    expect(gaugeShares("0.00", "0.00")).toEqual({ current: 0, changeStart: 0 });
  });
});
