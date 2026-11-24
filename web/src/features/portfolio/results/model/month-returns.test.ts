import { describe, expect, it } from "vitest";

import {
  monthReturns,
  monthRows,
} from "@/features/portfolio/results/model/month-returns";

const points = [
  { date: "2025-11-30", return_bp: 100 },
  { date: "2025-12-31", return_bp: 302 },
  { date: "2026-01-09", return_bp: 0 },
];

describe("monthReturns", () => {
  it("chains the cumulative return of the last point of each month", () => {
    const got = monthReturns(points);

    expect(got.map((m) => m.month)).toEqual(["2025-11", "2025-12", "2026-01"]);
    expect(got[0]?.value).toBeCloseTo(0.01, 6);
    expect(got[1]?.value).toBeCloseTo(0.02, 6);
    expect(got[2]?.value).toBeCloseTo(-0.029315, 6);
  });

  it("keeps the last point of a month", () => {
    const got = monthReturns([
      { date: "2025-11-15", return_bp: 50 },
      { date: "2025-11-30", return_bp: 100 },
    ]);

    expect(got).toHaveLength(1);
    expect(got[0]?.value).toBeCloseTo(0.01, 6);
  });

  it.each<[string, { date: string; return_bp?: number }[], number]>([
    [
      "a point without return_bp",
      [
        { date: "2025-11-30", return_bp: 100 },
        { date: "2025-12-31" },
        { date: "2026-01-31", return_bp: 200 },
      ],
      1,
    ],
    [
      "a first point without return_bp",
      [{ date: "2025-11-30" }, { date: "2025-12-31", return_bp: 100 }],
      0,
    ],
  ])("ends the list before %s", (_, input, want) => {
    expect(monthReturns(input)).toHaveLength(want);
  });
});

describe("monthRows", () => {
  it("groups the months by year, newest first", () => {
    const rows = monthRows(monthReturns(points));

    expect(rows).toHaveLength(2);
    expect(rows[0]?.year).toBe(2026);
    expect(rows[0]?.cells[0]).toBeCloseTo(-0.029315, 6);
    expect(rows[0]?.cells.slice(1)).toEqual(Array<null>(11).fill(null));
    expect(rows[0]?.total).toBeCloseTo(-0.029315, 6);
    expect(rows[0]?.accumulated).toBeCloseTo(0, 6);
    expect(rows[1]?.year).toBe(2025);
    expect(rows[1]?.cells.slice(0, 10)).toEqual(Array<null>(10).fill(null));
    expect(rows[1]?.cells[10]).toBeCloseTo(0.01, 6);
    expect(rows[1]?.cells[11]).toBeCloseTo(0.02, 6);
    expect(rows[1]?.total).toBeCloseTo(0.0302, 6);
    expect(rows[1]?.accumulated).toBeCloseTo(0.0302, 6);
  });

  it("holds no row without months", () => {
    expect(monthRows([])).toEqual([]);
  });
});
