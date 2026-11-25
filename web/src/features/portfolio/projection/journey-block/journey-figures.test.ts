import { describe, expect, it } from "vitest";

import { journeyFigures } from "@/features/portfolio/projection/journey-block/journey-figures";
import type { JourneyInput } from "@/features/portfolio/projection/journey-block/journey-figures";

// Born 1994-03-10; today 2026-11-25 (age 32); withdrawals from age 33 (2027-03) to 34 (2028-03);
// no real return and no inflation, so every figure is a sum.
const input: JourneyInput = {
  draft: {
    withdrawalAge: 33,
    lastAge: 34,
    realReturnBp: 0,
    inflationBp: 0,
    withdrawal: { mode: "income", income: 500 },
    changes: [{ month: "2026-11-01", amount: 1000 }],
    currency: "BRL",
  },
  history: {
    from: "2026-01-01",
    to: "2026-11-25",
    currency: "BRL",
    opening: 10000,
    points: [{ date: "2026-11-25", value: 10000, flows: 0 }],
    indexes: [],
  },
  birthDate: "1994-03-10",
  today: "2026-11-25",
  baseline: { date: "2026-10-20", value: 8000 },
};

describe("journeyFigures", () => {
  it("states the plan that sustains the income", () => {
    const f = journeyFigures(input);

    expect(f.withdrawalFrom).toBe("2027-03");
    expect(f.today).toBe(10000);
    expect(f.atWithdrawal).toBe(13000);
    expect(f.contributed).toBe(13000);
    expect(f.gain).toBe(0);
    expect(f.needed).toBe(6000);
    expect(f.way).toBeCloseTo(10000 / 6000, 10);
    expect(f.covered).toBeCloseTo(13000 / 6000, 10);
    expect(f.sustains).toBe(true);
    expect(f.endAge).toBeNull();
    expect(f.sustained).toBeCloseTo((500 * 13000) / 6000, 8);
  });

  it("states the age the income ends when the value reaches zero", () => {
    const f = journeyFigures({
      ...input,
      draft: { ...input.draft, withdrawal: { mode: "income", income: 2000 } },
    });

    expect(f.needed).toBe(24000);
    expect(f.sustains).toBe(false);
    expect(f.endAge).toBe(33);
    expect(f.sustained).toBeCloseTo(1083.3333, 3);
  });

  it("draws no amount needed and no way in rate mode", () => {
    const f = journeyFigures({
      ...input,
      draft: { ...input.draft, withdrawal: { mode: "rate", rate_bp: 600 } },
    });

    expect(f.needed).toBeNull();
    expect(f.way).toBeNull();
    expect(f.covered).toBeNull();
    expect(f.sustains).toBeNull();
    expect(f.sustained).toBe(65);
    expect(f.rows.filter((r) => r.withdrawal > 0)).toHaveLength(13);
  });

  it("PX13: states the money contributed and the return in today's money", () => {
    const f = journeyFigures({
      ...input,
      history: {
        ...input.history,
        indexes: [
          {
            index: "ipca",
            period: "month",
            points: [{ date: "2026-10-31", return_bp: 1000 }],
          },
        ],
      },
    });

    // The opening 10000 is 11000 of today, then three contributions of 1000; the value at the
    // withdrawal age stays 13000.
    expect(f.contributed).toBeCloseTo(14000, 6);
    expect(f.gain).toBeCloseTo(-1000, 6);
    expect(f.today).toBe(10000);
    expect(f.atWithdrawal).toBe(13000);
  });

  it("compares today with the plan line of the recorded history", () => {
    // PX7: the line starts on the 8000 of October, the baseline month, and November adds the
    // planned 1000: 9000 against 10000 recorded.
    const f = journeyFigures({
      ...input,
      history: {
        ...input.history,
        points: [
          { date: "2026-10-31", value: 8000, flows: 0 },
          ...input.history.points,
        ],
      },
    });

    expect(f.versus?.difference).toBe(1000);
    expect(f.versus?.differenceShare).toBeCloseTo(1000 / 9000, 10);
  });

  it("omits the comparison without a baseline", () => {
    expect(journeyFigures({ ...input, baseline: undefined }).versus).toBeNull();
  });
});
