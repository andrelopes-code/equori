import { describe, expect, it } from "vitest";

import {
  ninetyDayWindow,
  toChartPoints,
} from "@/features/accounts/balance-series";

describe("ninetyDayWindow", () => {
  it.each([
    ["2026-10-17", { from: "2026-07-20", to: "2026-10-17" }],
    ["2026-03-01", { from: "2025-12-02", to: "2026-03-01" }],
    ["2028-03-01", { from: "2027-12-03", to: "2028-03-01" }],
  ])("ends on %s and spans 90 days", (today, expected) => {
    expect(ninetyDayWindow(today)).toEqual(expected);
  });
});

describe("toChartPoints", () => {
  it("maps each balance to a number in major units", () => {
    expect(
      toChartPoints(
        {
          items: [
            {
              date: "2026-10-16",
              balance: { amount: -12345, currency: "BRL" },
            },
            { date: "2026-10-17", balance: { amount: 5, currency: "BRL" } },
          ],
        },
        2,
      ),
    ).toEqual([
      { date: "2026-10-16", value: -123.45 },
      { date: "2026-10-17", value: 0.05 },
    ]);
  });

  it("keeps whole units at scale 0", () => {
    expect(
      toChartPoints(
        {
          items: [
            { date: "2026-10-17", balance: { amount: 7, currency: "JPY" } },
          ],
        },
        0,
      ),
    ).toEqual([{ date: "2026-10-17", value: 7 }]);
  });
});
