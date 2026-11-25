import { describe, expect, it } from "vitest";

import { project } from "@/features/portfolio/projection/model/project";

// The case of the plan table: start 100000, 1% a month, contribution 1000 in the first three
// months, then a withdrawal of 60000 from 2027-02.
// Month 1: 100000 * 1.01 + 1000 = 102000. Month 2: 102000 * 1.01 + 1000 = 104020.
// Month 3: 104020 * 1.01 + 1000 = 106060.2.
// Month 4: 106060.2 * 1.01 - 60000 = 47120.802. Month 5: 47120.802 * 1.01 = 47592.01002 < 60000,
// so the value is 0 and the withdrawal is 47592.01002. Month 6: nothing left.
const input = {
  start: 100000,
  monthlyRate: 0.01,
  months: ["2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04"],
  changes: [{ month: "2026-11-01", amount: 1000 }],
  withdrawalFrom: "2027-02",
  income: 60000,
};

describe("project", () => {
  it("runs the value month by month under PX4", () => {
    const rows = project(input);

    expect(rows.map((r) => r.month)).toEqual(input.months);
    expect(rows[0]?.value).toBeCloseTo(102000, 6);
    expect(rows[1]?.value).toBeCloseTo(104020, 6);
    expect(rows[2]?.value).toBeCloseTo(106060.2, 6);
    expect(rows[3]?.value).toBeCloseTo(47120.802, 6);
    expect(rows[4]?.value).toBe(0);
    expect(rows[5]?.value).toBe(0);
  });

  it("splits each month into contribution, withdrawal and gain", () => {
    const rows = project(input);

    expect(rows[0]).toMatchObject({ contribution: 1000, withdrawal: 0 });
    expect(rows[0]?.gain).toBeCloseTo(1000, 6);
    expect(rows[2]).toMatchObject({ contribution: 1000, withdrawal: 0 });
    expect(rows[2]?.gain).toBeCloseTo(1040.2, 6);
    expect(rows[3]).toMatchObject({ contribution: 0, withdrawal: 60000 });
    expect(rows[3]?.gain).toBeCloseTo(1060.602, 6);
  });

  it("withdraws what was left when the value would fall below zero", () => {
    const rows = project(input);

    expect(rows[4]?.withdrawal).toBeCloseTo(47592.01, 2);
    expect(rows[4]?.contribution).toBe(0);
    expect(rows[5]?.withdrawal).toBe(0);
    expect(rows[5]?.gain).toBe(0);
  });

  it("follows the contribution in force of each month", () => {
    const rows = project({
      ...input,
      withdrawalFrom: "2099-01",
      changes: [
        { month: "2026-11-01", amount: 1000 },
        { month: "2026-12-01", amount: 0 },
      ],
    });

    expect(rows.map((r) => r.contribution)).toEqual([1000, 0, 0, 0, 0, 0]);
  });
});
