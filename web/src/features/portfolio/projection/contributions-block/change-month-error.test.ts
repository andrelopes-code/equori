import { describe, expect, it } from "vitest";

import {
  monthError,
  nextMonth,
} from "@/features/portfolio/projection/contributions-block/change-month-error";

const others = [
  { month: "2026-11-01", amount: 200000 },
  { month: "2027-03-01", amount: 300000 },
];

describe("monthError", () => {
  it.each([
    ["2026-11", "taken"],
    ["2027-03", "taken"],
    ["2026-09", "past"],
    ["2026-10", null],
    ["2027-01", null],
  ])("PJ2, PJ4: %s against the current month 2026-10 is %s", (month, want) => {
    expect(monthError(month, others, "2026-10")).toBe(want);
  });

  it("reports a past month before a taken one", () => {
    const past = [{ month: "2026-06-01", amount: 1 }];

    expect(monthError("2026-06", past, "2026-10")).toBe("past");
  });
});

describe("nextMonth", () => {
  it.each([
    [[], "2026-10", "2026-10"],
    [[{ month: "2026-06-01", amount: 1 }], "2026-10", "2026-10"],
    [[{ month: "2026-11-01", amount: 1 }], "2026-10", "2026-12"],
    [
      [
        { month: "2026-11-01", amount: 1 },
        { month: "2026-10-01", amount: 1 },
      ],
      "2026-10",
      "2026-12",
    ],
  ])(
    "starts a new change at the first free month after %j (current %s)",
    (changes, current, want) => {
      expect(nextMonth(changes, current)).toBe(want);
    },
  );
});
