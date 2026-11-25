import { describe, expect, it } from "vitest";

import { incomeEnd } from "@/features/portfolio/projection/model/income-end";
import { project } from "@/features/portfolio/projection/model/project";

const base = {
  start: 100000,
  monthlyRate: 0.01,
  months: ["2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04"],
  changes: [{ month: "2026-11-01", amount: 1000 }],
  withdrawalFrom: "2027-02",
};

describe("incomeEnd", () => {
  it("is the first month of withdrawals whose value is zero", () => {
    // The case of project.test.ts: the value is zero in its fifth month.
    expect(incomeEnd(project({ ...base, income: 60000 }))).toBe("2027-03");
  });

  it("is null when the value never reaches zero", () => {
    expect(incomeEnd(project({ ...base, income: 1000 }))).toBeNull();
  });

  it("is null before any withdrawal", () => {
    expect(
      incomeEnd(project({ ...base, withdrawalFrom: "2099-01", income: 1 })),
    ).toBeNull();
  });
});
