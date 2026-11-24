import { describe, expect, it } from "vitest";

import {
  evolutionFigures,
  irrRow,
} from "@/features/portfolio/results/evolution-block/evolution-figures";

describe("evolutionFigures", () => {
  // PR9: return = closing - opening - net contributions.
  it("derives the net contributions, the return and the closing value", () => {
    const figures = evolutionFigures({
      currency: "BRL",
      opening: 0,
      points: [
        { date: "2025-10-31", value: 100000, flows: 100000 },
        { date: "2025-11-30", value: 101000, flows: 0 },
        { date: "2025-12-31", value: 203020, flows: 100000 },
      ],
    });

    expect(figures).toEqual({
      opening: 0,
      net: 200000,
      gain: 3020,
      closing: 203020,
    });
  });

  it("states a loss and a withdrawal with their signs", () => {
    const figures = evolutionFigures({
      currency: "BRL",
      opening: 100000,
      points: [
        { date: "2025-11-30", value: 40000, flows: -50000 },
        { date: "2025-12-31", value: 45000, flows: 0 },
      ],
    });

    expect(figures).toEqual({
      opening: 100000,
      net: -50000,
      gain: -5000,
      closing: 45000,
    });
  });
});

describe("irrRow", () => {
  it.each([
    { days: 364, bp: 961, expected: { kind: "short" } },
    { days: 365, bp: 961, expected: { kind: "rate", bp: 961 } },
    { days: 3660, bp: -20, expected: { kind: "rate", bp: -20 } },
    { days: 3661, bp: 961, expected: null },
    { days: 400, bp: undefined, expected: null },
  ])("days $days, rate $bp", ({ days, bp, expected }) => {
    expect(irrRow(days, bp)).toEqual(expected);
  });
});
