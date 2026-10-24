import { describe, expect, it } from "vitest";

import { netWorthChange } from "@/features/overview/net-worth";

const worth = (assets: number, liabilities: number) => ({
  assets: { amount: assets, currency: "BRL" },
  liabilities: { amount: liabilities, currency: "BRL" },
  net: { amount: assets - liabilities, currency: "BRL" },
});

describe("netWorthChange", () => {
  it("S129: reads the change of the net against the previous month end", () => {
    // Assets 2,205.00 and a loan of 1,200.00 give net 1,005.00; the month before held 1,005.00 − 150.00.
    const change = netWorthChange(worth(220500, 120000), worth(205500, 120000));
    expect(change).toEqual({ amount: 15000, fraction: 15000 / 85500 });
  });

  it("has no fraction when the previous net is zero", () => {
    expect(netWorthChange(worth(100, 0), worth(0, 0))).toEqual({
      amount: 100,
      fraction: undefined,
    });
  });

  it("divides by the magnitude of a negative previous net", () => {
    const change = netWorthChange(worth(0, 50), worth(0, 100));
    expect(change.fraction).toBe(50 / 100);
  });
});
