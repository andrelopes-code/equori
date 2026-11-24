import { describe, expect, it } from "vitest";

import { evolutionRows } from "@/features/portfolio/results/evolution-block/evolution-rows";

describe("evolutionRows", () => {
  // PR9: the value, the money contributed as a running sum and the flow of each month.
  it("writes the value, the contributed money and the flow in major units", () => {
    const rows = evolutionRows(
      {
        currency: "BRL",
        opening: 0,
        points: [
          { date: "2025-10-31", value: 100000, flows: 100000 },
          { date: "2025-11-30", value: 101000, flows: 0 },
          { date: "2025-12-31", value: 203020, flows: 100000 },
        ],
      },
      2,
    );

    expect(rows).toEqual([
      {
        date: "2025-10-31",
        value: 1000,
        contributed: 1000,
        flowIn: 1000,
        flowOut: null,
      },
      {
        date: "2025-11-30",
        value: 1010,
        contributed: 1000,
        flowIn: null,
        flowOut: null,
      },
      {
        date: "2025-12-31",
        value: 2030.2,
        contributed: 2000,
        flowIn: 1000,
        flowOut: null,
      },
    ]);
  });

  it("puts a withdrawal in the outflow", () => {
    const rows = evolutionRows(
      {
        currency: "BRL",
        opening: 100000,
        points: [{ date: "2025-11-30", value: 40000, flows: -50000 }],
      },
      2,
    );

    expect(rows).toEqual([
      {
        date: "2025-11-30",
        value: 400,
        contributed: 500,
        flowIn: null,
        flowOut: -500,
      },
    ]);
  });
});
