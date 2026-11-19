import { describe, expect, it } from "vitest";

import { creditAnswer } from "@/features/calculators/credit-cost-calculator/credit-answer";

describe("creditAnswer", () => {
  const base = {
    released: 1000000,
    fees: 20000,
    installment: 88849,
    count: 12,
    releaseDate: "2026-01-10",
    firstDue: "2026-02-10",
  };

  it("gives the annual cost, the total paid and the cost by integer subtraction", () => {
    const got = creditAnswer(base);

    expect(got.kind).toBe("solved");
    if (got.kind !== "solved") return;

    expect(got.annual).toBe(0.1714);
    // 20,000 of fees plus 12 installments of 88,849.
    expect(got.paid).toBe(1086188);
    // 1,086,188 paid less 1,000,000 released.
    expect(got.cost).toBe(86188);
  });

  it("states the monthly rate the annual cost is equivalent to", () => {
    const got = creditAnswer(base);

    // 1.1714 ^ (1 / 12) - 1 = 0.013271.
    expect(got.kind === "solved" && got.monthly).toBeCloseTo(0.013271, 6);
  });

  it("lists one flow per installment with its days from the release", () => {
    const got = creditAnswer(base);

    expect(got.kind === "solved" && got.flows).toHaveLength(12);
    // 2026-02-10 is 31 days after 2026-01-10; 2026-03-10 is 28 days after that.
    expect(got.kind === "solved" && got.flows.slice(0, 2)).toEqual([
      { date: "2026-02-10", days: 31, amount: 88849 },
      { date: "2026-03-10", days: 59, amount: 88849 },
    ]);
  });

  it.each([
    { name: "no amount released", input: { ...base, released: null } },
    { name: "no installment", input: { ...base, installment: null } },
    { name: "no count", input: { ...base, count: null } },
    { name: "no first due date", input: { ...base, firstDue: null } },
  ])("is missing with $name", ({ input }) => {
    expect(creditAnswer(input)).toEqual({ kind: "missing" });
  });

  it("refuses a first due date that does not come after the release", () => {
    expect(creditAnswer({ ...base, firstDue: "2026-01-10" })).toEqual({
      kind: "order",
    });
  });

  it("finds no annual cost when one installment is far below the amount released", () => {
    // At -99% a year, 1 minor unit due in 31 days is worth about 1.5: never 1,000,000.
    expect(
      creditAnswer({ ...base, fees: 0, installment: 1, count: 1 }),
    ).toEqual({ kind: "no_solution" });
  });
});
