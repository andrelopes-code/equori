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
    contribution: 700,
    withdrawal: 0,
    gain: 300,
    value: 12000,
  },
  {
    month: "2027-01",
    contribution: 300,
    withdrawal: 0,
    gain: 200,
    value: 12500,
  },
];

describe("journeyRows", () => {
  it("draws the history in major units and anchors the projection on today", () => {
    expect(journeyRows(history, projection, "2054-03", 2)).toEqual([
      {
        date: "2026-10-31",
        value: 100,
        contributed: 90,
        projected: null,
        top: 100,
      },
      {
        date: "2026-11-25",
        value: 110,
        contributed: 95,
        projected: 110,
        top: 110,
      },
      // The money contributed goes on from the recorded 95.00: 95 + 7, then + 3.
      {
        date: "2026-12-31",
        value: null,
        contributed: 102,
        projected: 120,
        top: 120,
      },
      {
        date: "2027-01-31",
        value: null,
        contributed: 105,
        projected: 125,
        top: 125,
      },
    ]);
  });

  it("draws only the projection when the history holds no point", () => {
    expect(
      journeyRows({ ...history, points: [] }, projection, "2054-03", 2),
    ).toEqual([
      {
        date: "2026-12-31",
        value: null,
        contributed: 7,
        projected: 120,
        top: 120,
      },
      {
        date: "2027-01-31",
        value: null,
        contributed: 10,
        projected: 125,
        top: 125,
      },
    ]);
  });

  it("PX6: ends the money contributed on the month before the withdrawals", () => {
    const rows = journeyRows(history, projection, "2027-01", 2);

    expect(rows.map((r) => [r.date, r.contributed, r.projected])).toEqual([
      ["2026-10-31", 90, null],
      ["2026-11-25", 95, 110],
      ["2026-12-31", 102, 120],
      ["2027-01-31", null, 125],
    ]);
  });

  it("PX15: draws each typed case from today's value", () => {
    const cautious = projection.map((r) => ({ ...r, value: r.value - 1000 }));
    const rows = journeyRows(history, projection, "2054-03", 2, { cautious });

    expect(rows.map((r) => r.cautious)).toEqual([null, 110, 110, 115]);
    expect(rows.map((r) => r.favorable)).toEqual(Array(4).fill(undefined));
  });
});
