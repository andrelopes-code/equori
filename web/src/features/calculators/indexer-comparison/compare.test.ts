import { describe, expect, it } from "vitest";

import {
  compare,
  referenceOf,
} from "@/features/calculators/indexer-comparison/compare";
import type { Security } from "@/features/calculators/indexer-comparison/security";

describe("compare", () => {
  it("gives the result of each security, taxed or exempt, in order", () => {
    const rows = compare({
      amount: 1000000,
      days: 720,
      taxBp: 1750,
      securities: [
        { form: "fixed", rate: 0.12, taxed: true },
        { form: "fixed", rate: 0.1, taxed: false },
      ],
      indexes: new Map(),
    });

    expect(rows[0]).toMatchObject({ gross: 250511, tax: 43839, net: 206672 });
    expect(rows[0]?.netAnnualRate).toBeCloseTo(0.0999203, 7);
    expect(rows[1]).toMatchObject({ gross: 206845, tax: 0, net: 206845 });
  });

  it("is null at the position of a security whose index has no data", () => {
    const rows = compare({
      amount: 1000000,
      days: 720,
      taxBp: 1750,
      securities: [
        { form: "fixed", rate: 0.12, taxed: true },
        { form: "percent", index: "cdi", rate: 1.4, taxed: true },
      ],
      indexes: new Map(),
    });

    expect(rows[0]).not.toBeNull();
    expect(rows[1]).toBeNull();
  });
});

describe("referenceOf", () => {
  it.each([
    [[percent(), fixed(), fixed()], 1],
    [[percent(), { ...percent(), form: "spread" as const }], 0],
  ])("takes the position of the reference in %j", (securities, position) => {
    expect(referenceOf(securities)).toBe(position);
  });
});

function fixed(): Security {
  return { form: "fixed", rate: 0.1, taxed: true };
}

function percent(): Security {
  return { form: "percent", index: "cdi", rate: 1.4, taxed: true };
}
