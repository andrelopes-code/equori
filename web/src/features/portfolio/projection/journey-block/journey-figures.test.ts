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
    incomes: [],
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

  it("PX4: the sustained income, typed as the income, lasts to the last age", () => {
    const { sustained } = journeyFigures(input);
    const f = journeyFigures({
      ...input,
      draft: {
        ...input.draft,
        withdrawal: { mode: "income", income: Math.floor(sustained) },
      },
    });

    expect(f.sustains).toBe(true);
    expect(f.rows.filter((r) => r.withdrawal > 0)).toHaveLength(12);
  });

  it("PX4: the value that pays every withdrawal and ends on zero sustains the income", () => {
    const f = journeyFigures({
      ...input,
      history: {
        ...input.history,
        points: [{ date: "2026-11-25", value: 3000, flows: 0 }],
      },
    });

    expect(f.atWithdrawal).toBe(6000);
    expect(f.covered).toBe(1);
    expect(f.rows.at(-1)).toMatchObject({ withdrawal: 500, value: 0 });
    expect(f.sustains).toBe(true);
    expect(f.endAge).toBeNull();
  });

  it("PX5: needs only the withdrawals the projection holds", () => {
    // The birthday is later in the current month, so the withdrawals run from the next month: 11.
    const f = journeyFigures({
      ...input,
      today: "2027-03-05",
      history: {
        ...input.history,
        points: [{ date: "2027-03-05", value: 10000, flows: 0 }],
      },
    });

    expect(f.rows.filter((r) => r.withdrawal > 0)).toHaveLength(11);
    expect(f.needed).toBe(5500);
  });

  it("PX19: a plan whose withdrawals started counts from today, with no contribution", () => {
    // Born 1994-03-10, withdrawals since 2025-03: 15 months are left until 2028-02.
    const f = journeyFigures({
      ...input,
      draft: { ...input.draft, withdrawalAge: 31 },
    });

    expect(f.started).toBe(true);
    expect(f.atWithdrawal).toBe(10000);
    expect(f.contributed).toBe(10000);
    expect(f.rows.map((r) => r.contribution)).toEqual(Array(15).fill(0));
    expect(f.needed).toBe(7500);
    expect(f.covered).toBeCloseTo(10000 / 7500, 10);
    expect(journeyFigures(input).started).toBe(false);
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
    expect(f.rows.filter((r) => r.withdrawal > 0)).toHaveLength(12);
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

  it("PX15: projects each typed case with its return, the same difference in the withdrawals", () => {
    const f = journeyFigures({
      ...input,
      draft: {
        ...input.draft,
        realReturnBp: 100,
        withdrawalReturnBp: 0,
        cautiousReturnBp: 0,
        favorableReturnBp: 300,
      },
    });
    const rate = (bp: number) => (1 + bp / 10000) ** (1 / 12) - 1;
    const grown = (r: number) =>
      ((10000 * (1 + r) + 1000) * (1 + r) + 1000) * (1 + r) + 1000;
    const needed = (r: number) => (500 * (1 - (1 + r) ** -12)) / r;

    expect(f.cases.map((c) => [c.kind, c.returnBp])).toEqual([
      ["cautious", 0],
      ["favorable", 300],
    ]);
    // The cautious case saves at 0% and withdraws at 0% - 1%; the favorable at 3% and at 0% + 2%.
    expect(f.atWithdrawal).toBeCloseTo(grown(rate(100)), 6);
    expect(f.needed).toBe(6000);
    expect(f.cases[0]?.atWithdrawal).toBe(13000);
    expect(f.cases[0]?.needed).toBeCloseTo(needed(rate(-100)), 6);
    expect(f.cases[1]?.atWithdrawal).toBeCloseTo(grown(rate(300)), 6);
    expect(f.cases[1]?.needed).toBeCloseTo(needed(rate(200)), 6);
  });

  it("PX15: holds no case without a typed return", () => {
    expect(journeyFigures(input).cases).toEqual([]);
  });

  it("PX14: states the amount needed and the income net of the tax on the gain", () => {
    const taxed = {
      ...input,
      draft: { ...input.draft, gainTaxBp: 2000 },
      history: {
        ...input.history,
        opening: 3500,
        points: [{ date: "2026-11-25", value: 10000, flows: 0 }],
      },
    };
    const f = journeyFigures(taxed);

    // 3500 contributed and 3000 more until the withdrawals: half of the 13000 is gain, so 500 net
    // is 500 / 0.9 gross, 12 times.
    expect(f.needed).toBeCloseTo((500 / 0.9) * 12, 6);
    expect(f.sustained).toBeCloseTo((13000 / 12) * 0.9, 6);
    expect(f.rows.find((r) => r.withdrawal > 0)?.withdrawal).toBeCloseTo(
      500 / 0.9,
      6,
    );

    // The rate gives the gross: 13000 * 6% / 12 = 65, of which half is gain: 65 * 0.9.
    const rate = journeyFigures({
      ...taxed,
      draft: { ...taxed.draft, withdrawal: { mode: "rate", rate_bp: 600 } },
    });
    expect(rate.sustained).toBeCloseTo(58.5, 6);
    expect(rate.rows.find((r) => r.withdrawal > 0)?.withdrawal).toBeCloseTo(
      65,
      6,
    );
  });

  it("PX14: a history that took out more than it put in taxes the whole withdrawal at most", () => {
    const f = journeyFigures({
      ...input,
      draft: {
        ...input.draft,
        gainTaxBp: 2000,
        changes: [{ month: "2026-11-01", amount: 0 }],
      },
      history: {
        ...input.history,
        opening: 0,
        points: [{ date: "2026-11-25", value: 10000, flows: -5000 }],
      },
    });

    // Nothing is left of the money contributed, so all of it is gain: 500 / (1 - 0.2).
    expect(f.rows.find((r) => r.withdrawal > 0)?.withdrawal).toBeCloseTo(
      625,
      6,
    );
    expect(f.needed).toBeCloseTo(625 * 12, 6);
  });

  // Three years of withdrawals, 36 months, from 13000.
  const years = { ...input, draft: { ...input.draft, lastAge: 36 } };

  it("PX4, PX5, PX20: an other income takes the place of the portfolio in its months", () => {
    const f = journeyFigures({
      ...years,
      draft: {
        ...years.draft,
        incomes: [{ name: "Rent", amount: 200, start_age: 34, end_age: 35 }],
      },
    });

    // 12 * 500 + 12 * 300 + 12 * 500 = 15600; 36 X - 2400 = 13000. After two years 3400 is left:
    // it pays six of the last twelve months and ends in the seventh, 2029-09, at age 35.
    expect(f.needed).toBe(15600);
    expect(f.covered).toBeCloseTo(13000 / 15600, 10);
    expect(f.sustained).toBeCloseTo(15400 / 36, 6);
    expect(f.sustains).toBe(false);
    expect(f.endAge).toBe(35);
    expect(
      f.rows
        .slice(3, 39)
        .map((r) => r.withdrawal)
        .slice(11, 13),
    ).toEqual([500, 300]);
    expect(f.without?.needed).toBe(18000);
    expect(f.without?.sustained).toBeCloseTo(13000 / 36, 6);
  });

  it("PX20: other incomes that cover the income leave nothing to need", () => {
    const f = journeyFigures({
      ...years,
      draft: {
        ...years.draft,
        incomes: [{ name: "Pension", amount: 600, start_age: 33 }],
      },
    });

    expect(f.needed).toBe(0);
    expect(f.covered).toBeNull();
    expect(f.sustains).toBe(true);
    expect(f.atWithdrawal).toBe(13000);
    expect(f.rows.at(-1)?.value).toBe(13000);
    expect(f.sustained).toBeCloseTo(600 + 13000 / 36, 6);
    expect(f.without?.sustains).toBe(false);
  });

  it("PX5, PX14: the tax is on the part the portfolio pays", () => {
    const f = journeyFigures({
      ...input,
      draft: {
        ...input.draft,
        gainTaxBp: 2000,
        changes: [{ month: "2026-11-01", amount: 0 }],
        incomes: [{ name: "Pension", amount: 100, start_age: 33 }],
      },
      history: {
        ...input.history,
        opening: 0,
        points: [{ date: "2026-11-25", value: 10000, flows: -5000 }],
      },
    });

    // All of it is gain: (500 - 100) / 0.8 = 500 gross, 12 times; 10000 * 0.8 / 12 + 100.
    expect(f.needed).toBeCloseTo(6000, 6);
    expect(f.sustained).toBeCloseTo(8000 / 12 + 100, 6);
  });

  it("PX4: in rate mode an other income leaves the withdrawals as they are", () => {
    const rate = {
      ...years.draft,
      withdrawal: { mode: "rate" as const, rate_bp: 600 },
    };
    const f = journeyFigures({
      ...years,
      draft: {
        ...rate,
        incomes: [{ name: "Pension", amount: 100, start_age: 33 }],
      },
    });

    expect(f.rows).toEqual(journeyFigures({ ...years, draft: rate }).rows);
    expect(f.sustained).toBe(65);
  });

  it("PX20: a plan with no value ends at the first withdrawal", () => {
    const f = journeyFigures({
      ...input,
      draft: {
        ...input.draft,
        changes: [{ month: "2026-11-01", amount: 0 }],
      },
      history: {
        ...input.history,
        points: [{ date: "2026-11-25", value: 0, flows: 0 }],
      },
    });

    expect(f.sustains).toBe(false);
    expect(f.endAge).toBe(32);
    expect(f.without).toBeNull();
  });
});
