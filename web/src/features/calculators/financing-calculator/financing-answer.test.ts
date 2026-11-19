import { describe, expect, it } from "vitest";

import {
  priceSchedule,
  sacSchedule,
} from "@/features/calculators/financing-calculator/annuity";
import {
  financingFacts,
  prepayChoices,
} from "@/features/calculators/financing-calculator/financing-answer";
import { annualToMonthly } from "@/features/calculators/model/rate-math";

const amount = 30000000;
const rate = annualToMonthly(0.115);
const months = 360;

describe("financingFacts", () => {
  it("takes the total paid and the interest of Price and the interest saved in SAC", () => {
    const facts = financingFacts(
      priceSchedule(amount, rate, months),
      sacSchedule(amount, rate, months),
    );

    expect(facts).toEqual({
      paid: 102319789,
      interest: 72319789,
      // 72319789 - 49344212
      saved: 22975577,
    });
  });
});

describe("prepayChoices", () => {
  const input = { amount, rate, months, month: 24, extra: 2000000 };

  it("states what shortening the term and lowering the installment save", () => {
    expect(prepayChoices(input)).toEqual({
      // 65788013 - 41002454; (360 - 24) - 242
      keepInstallment: { months: 242, fewer: 94, saved: 24785559 },
      // 65788013 - 61359428
      keepTerm: { installment: 265091, saved: 4428585 },
    });
  });

  it("returns null for a month outside 1 to the term minus one", () => {
    expect(prepayChoices({ ...input, month: 0 })).toBeNull();
    expect(prepayChoices({ ...input, month: months })).toBeNull();
  });
});
