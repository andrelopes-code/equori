import { describe, expect, it } from "vitest";

import { caseRows } from "@/features/portfolio/projection/cases-block/case-rows";
import type { JourneyFigures } from "@/features/portfolio/projection/journey-block/journey-figures";

const plan = {
  rows: [],
  atWithdrawal: 10,
  needed: 20,
  covered: 0.5,
  sustained: 5,
  sustains: false,
  endAge: 70,
};

const figures: JourneyFigures = {
  ...plan,
  withdrawalFrom: "2050-01",
  started: false,
  withdrawalAge: 60,
  lastAge: 90,
  today: 1,
  contributed: 1,
  gain: 0,
  way: null,
  income: 10,
  versus: null,
  without: null,
  cases: [
    { ...plan, kind: "cautious", returnBp: 200 },
    { ...plan, kind: "favorable", returnBp: 600 },
  ],
};

describe("caseRows", () => {
  it("PX16: lists the plan between the cases", () => {
    expect(
      caseRows(figures, 400).map((r) => [r.kind, r.returnBp, r.atWithdrawal]),
    ).toEqual([
      ["cautious", 200, 10],
      ["plan", 400, 10],
      ["favorable", 600, 10],
    ]);
  });
});
