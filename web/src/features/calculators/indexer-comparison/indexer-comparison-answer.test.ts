import { describe, expect, it } from "vitest";

import { breakEven } from "@/features/calculators/indexer-comparison/break-even/break-even";
import type { ComparisonRow } from "@/features/calculators/indexer-comparison/compare";
import { indexerAnswer } from "@/features/calculators/indexer-comparison/indexer-comparison-answer";
import type {
  IndexData,
  Security,
} from "@/features/calculators/indexer-comparison/security";

const fixed: Security = { form: "fixed", rate: 0.08, taxed: true };
const percent: Security = {
  form: "percent",
  index: "cdi",
  rate: 1.4,
  taxed: true,
};
const cdi: IndexData = {
  id: "cdi",
  period: "day",
  rates: [],
  points: [{ date: "2026-11-18", rate: 0.1 }],
  surveyDate: "2026-11-13",
  dailySpread: false,
};
const indexes = new Map([["cdi", cdi]]);
const amount = 1_000_000;

function row(security: Security, net: number, annualRate = 0.1): ComparisonRow {
  return {
    security,
    annualRate,
    gross: net + 100,
    redemption: 0,
    tax: 100,
    net,
    netAnnualRate: annualRate / 2,
  };
}

function answer(
  securities: Security[],
  rows: (ComparisonRow | null)[],
  taxBp = 1500,
) {
  return indexerAnswer({ amount, securities, rows, indexes, days: 731, taxBp });
}

describe("indexerAnswer", () => {
  it("names the security with the largest final value and the gap to the next", () => {
    const got = answer(
      [fixed, percent],
      [row(fixed, 141_649, 0.08), row(percent, 200_000, 0.14)],
    );

    expect(got).toEqual({
      kind: "leader",
      winner: 1,
      next: 0,
      final: 1_200_000,
      difference: 58_351,
      netRate: 0.07,
      breakEven: breakEven({
        security: percent,
        data: cdi,
        reference: fixed,
        referenceRate: 0.08,
        days: 731,
        taxBp: 1500,
      }),
    });
  });

  it("takes the break-even of the floating next when the leader is fixed", () => {
    const got = answer(
      [fixed, percent],
      [row(fixed, 300_000, 0.08), row(percent, 200_000, 0.14)],
    );

    expect(got).toMatchObject({ kind: "leader", winner: 0, next: 1 });
    expect(got).toHaveProperty(
      "breakEven",
      breakEven({
        security: percent,
        data: cdi,
        reference: fixed,
        referenceRate: 0.08,
        days: 731,
        taxBp: 1500,
      }),
    );
  });

  it("compares the leader with the second largest, not the typed neighbour", () => {
    const third: Security = { form: "fixed", rate: 0.09, taxed: true };

    const got = answer(
      [fixed, percent, third],
      [row(fixed, 100_000), row(percent, 300_000), row(third, 250_000)],
    );

    expect(got).toMatchObject({
      kind: "leader",
      winner: 1,
      next: 2,
      final: 1_300_000,
      difference: 50_000,
    });
  });

  it("states equal final values of the two best", () => {
    const got = answer(
      [fixed, percent],
      [row(fixed, 200_000, 0.1), row(percent, 200_000, 0.1)],
    );

    expect(got).toEqual({ kind: "equal", final: 1_200_000, netRate: 0.05 });
  });

  it("asks for another security when there is one", () => {
    expect(answer([fixed], [row(fixed, 100_000)])).toEqual({ kind: "single" });
    expect(answer([fixed], [null])).toEqual({ kind: "single" });
  });

  it("is null while one of two securities lacks a rate", () => {
    expect(answer([fixed, percent], [row(fixed, 100_000), null])).toBeNull();
  });

  it("is null while no security has a rate", () => {
    expect(answer([fixed, percent], [null, null])).toBeNull();
  });
});
