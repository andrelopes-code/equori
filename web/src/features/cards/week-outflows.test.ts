import { describe, expect, it } from "vitest";

import { daysSinceMonday, weekOutflows } from "@/features/cards/week-outflows";

describe("daysSinceMonday", () => {
  it.each([
    ["2026-10-26", 0],
    ["2026-10-29", 3],
    ["2026-11-01", 6],
  ])("returns the days since Monday for %s", (iso, want) => {
    expect(daysSinceMonday(iso)).toBe(want);
  });
});

describe("weekOutflows", () => {
  it("takes each day's outflow and 0 on a day without a flow", () => {
    const flows = [
      flowDay("2026-10-26", 1500),
      flowDay("2026-10-28", 300),
      flowDay("2026-10-30", 900),
    ];

    const got = weekOutflows("2026-10-26", 3, flows);

    expect(got).toEqual([1500, 0, 300, 0]);
  });
});

function flowDay(date: string, outflow: number) {
  return {
    date,
    inflow: { amount: 0, currency: "BRL" },
    outflow: { amount: outflow, currency: "BRL" },
  } as never;
}
