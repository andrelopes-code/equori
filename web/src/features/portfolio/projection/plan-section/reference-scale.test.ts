import { describe, expect, it } from "vitest";

import { referenceScale } from "@/features/portfolio/projection/plan-section/reference-scale";

const none = {
  realBp: null,
  cautiousBp: null,
  favorableBp: null,
  curve: null,
  portfolio: null,
};

describe("referenceScale", () => {
  it("PX17, PX22: the plan's range, the curve and the portfolio on one axis from 0 to 15", () => {
    const scale = referenceScale({
      realBp: 550,
      cautiousBp: 350,
      favorableBp: 700,
      curve: 0.0754,
      portfolio: 0.138,
    });

    expect(scale?.ticks).toEqual([
      { value: 0, at: 0 },
      { value: 5, at: 1 / 3 },
      { value: 10, at: 2 / 3 },
      { value: 15, at: 1 },
    ]);
    expect(scale?.rows).toEqual([
      { kind: "plan", from: 3.5 / 15, to: 7 / 15, at: 5.5 / 15 },
      { kind: "curve", from: 0, to: 7.54 / 15 },
      { kind: "portfolio", from: 0, to: 13.8 / 15 },
    ]);
  });

  it("PX22: a negative value opens the axis at the multiple of 5 below it", () => {
    const scale = referenceScale({ ...none, realBp: -250, portfolio: 0.04 });

    expect(scale?.ticks.map((t) => t.value)).toEqual([-5, 0, 5]);
    expect(scale?.rows).toEqual([
      { kind: "plan", from: 0.25, to: 0.25, at: 0.25 },
      { kind: "portfolio", from: 0.5, to: 0.9 },
    ]);
  });

  it("PX22: a value on a multiple of 5 closes the axis on it", () => {
    const scale = referenceScale({ ...none, realBp: 300, curve: 0.1 });

    expect(scale?.ticks.map((t) => t.value)).toEqual([0, 5, 10]);
  });

  it("PX17: without a typed return the plan draws no row", () => {
    expect(
      referenceScale({ ...none, curve: 0.0754 })?.rows.map((r) => r.kind),
    ).toEqual(["curve"]);
  });

  it("PX17: is null without the curve and the portfolio", () => {
    expect(
      referenceScale({ ...none, realBp: 550, cautiousBp: 350 }),
    ).toBeNull();
  });
});
