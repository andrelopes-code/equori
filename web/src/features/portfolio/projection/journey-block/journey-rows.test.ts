import { describe, expect, it } from "vitest";

import { journeyRows } from "@/features/portfolio/projection/journey-block/journey-rows";

const history = {
  from: "2026-01-01",
  to: "2026-11-25",
  currency: "BRL",
  opening: 9000,
  points: [
    { date: "2026-10-31", value: 10000, flows: 0 },
    { date: "2026-11-25", value: 11000, flows: 500 },
  ],
  indexes: [],
};

const projection = [
  {
    month: "2026-12",
    contribution: 0,
    withdrawal: 0,
    gain: 0,
    value: 12000,
  },
];

describe("journeyRows", () => {
  it("draws the history in major units and anchors the projection on today", () => {
    expect(journeyRows(history, projection, 2)).toEqual([
      { date: "2026-10-31", value: 100, contributed: 90, projected: null },
      { date: "2026-11-25", value: 110, contributed: 95, projected: 110 },
      { date: "2026-12-31", value: null, contributed: null, projected: 120 },
    ]);
  });

  it("draws only the projection when the history holds no point", () => {
    expect(journeyRows({ ...history, points: [] }, projection, 2)).toEqual([
      { date: "2026-12-31", value: null, contributed: null, projected: 120 },
    ]);
  });
});
