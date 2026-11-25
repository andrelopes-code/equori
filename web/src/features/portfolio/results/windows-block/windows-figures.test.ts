import { describe, expect, it } from "vitest";

import {
  windowFigures,
  windowRows,
} from "@/features/portfolio/results/windows-block/windows-figures";

// A portfolio that gains 1 point a month for a year and then moves on: 14 whole months give 3
// windows.
const growth = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200];
const points = [
  ...growth.map((bp, k) => ({
    date: new Date(Date.UTC(2025, k + 1, 0)).toISOString().slice(0, 10),
    value: 1,
    flows: 0,
    return_bp: bp,
  })),
  { date: "2026-01-31", value: 1, flows: 0, return_bp: 1100 },
  { date: "2026-02-28", value: 1, flows: 0, return_bp: 1400 },
];

const series = (indexes: unknown[] = []) =>
  ({
    from: "2025-01-01",
    to: "2026-02-28",
    currency: "BRL",
    opening: 1,
    points,
    indexes,
  }) as Parameters<typeof windowFigures>[0];

describe("windowFigures", () => {
  it("finds the windows, their extremes and the share below zero", () => {
    const got = windowFigures(series());

    expect(got.windows.map((w) => w.end)).toEqual([
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
    expect(got.windows[0]?.value).toBeCloseTo(0.12, 6);
    expect(got.windows[1]?.value).toBeCloseTo(1.11 / 1.01 - 1, 6);
    expect(got.windows[2]?.value).toBeCloseTo(1.14 / 1.02 - 1, 6);
    expect(got.extremes?.best.end).toBe("2025-12");
    expect(got.extremes?.worst.end).toBe("2026-01");
    expect(got.negative).toEqual({ count: 0, total: 3, share: 0 });
    expect(got.months).toBe(14);
    expect(got.firstClose).toBe("2025-12-31");
  });

  // PR7: 2 January to 25 February holds 12 whole months, February 2025 to January 2026.
  it("leaves the partial first and last months out of the windows", () => {
    const got = windowFigures({
      ...series(),
      from: "2025-01-02",
      to: "2026-02-25",
      points: points.map((p) =>
        p.date === "2026-02-28" ? { ...p, date: "2026-02-25" } : p,
      ),
    });

    expect(got.windows.map((w) => w.end)).toEqual(["2026-01"]);
    expect(got.windows[0]?.value).toBeCloseTo(1.11 / 1.01 - 1, 6);
    expect(got.months).toBe(12);
    expect(got.firstClose).toBe("2026-01-31");
  });

  // PR7: an index without a window of the same end leaves the total of its share.
  it("compares with an index only the windows both hold", () => {
    const ipca = {
      index: "ipca",
      period: "month",
      points: points.slice(0, 13).map((p) => ({ date: p.date, return_bp: 0 })),
    };
    const got = windowFigures(series([ipca]));

    expect(got.windows).toHaveLength(3);
    expect(got.indexes[0]?.above).toEqual({ count: 2, total: 2, share: 1 });
  });

  it("has no share against an index without a window", () => {
    const young = {
      index: "ipca",
      period: "month",
      points: [{ date: "2026-02-28", return_bp: 0 }],
    };

    expect(windowFigures(series([young])).indexes[0]?.above).toBeNull();
  });

  it("counts the windows above the first two indexes only", () => {
    const flat = (index: string, bp: number) => ({
      index,
      period: "day",
      points: points.map((p) => ({ date: p.date, return_bp: bp })),
    });
    const got = windowFigures(
      series([flat("cdi", 0), flat("ibov", 0), flat("ipca", 0)]),
    );

    expect(got.indexes.map((i) => i.above?.count ?? null)).toEqual([
      3,
      3,
      null,
    ]);
    expect(got.indexes.map((i) => i.dashed)).toEqual([false, true, true]);
  });

  it("has no extremes under 12 months and closes the first window on its twelfth whole month", () => {
    const short = {
      ...series(),
      from: "2024-02-29",
      points: points.slice(0, 5),
    };
    const got = windowFigures(short);

    expect(got.windows).toEqual([]);
    expect(got.extremes).toBeNull();
    expect(got.months).toBe(5);
    expect(got.firstClose).toBe("2025-02-28");
  });
});

describe("windowRows", () => {
  it("bounds the area below zero and joins the window of each index by its end", () => {
    const negative = {
      ...series([
        {
          index: "cdi",
          period: "day",
          points: [{ date: "2026-02-28", return_bp: 50 }],
        },
      ]),
      points: points.map((p, k) => ({ ...p, return_bp: k === 13 ? -300 : 0 })),
    };
    const rows = windowRows(windowFigures(negative));

    expect(rows).toHaveLength(3);
    expect(rows[2]).toMatchObject({
      date: "2026-02-01",
      lower: expect.closeTo(-0.03, 6) as number,
      upper: 0,
      cdi: null,
    });
    expect(rows[0]).toMatchObject({ portfolio: 0, lower: 0, upper: 0 });
  });
});
