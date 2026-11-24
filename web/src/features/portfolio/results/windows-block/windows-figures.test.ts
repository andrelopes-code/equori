import { describe, expect, it } from "vitest";

import {
  windowFigures,
  windowRows,
} from "@/features/portfolio/results/windows-block/windows-figures";

// A portfolio that gains 1% a month for a year and then moves on: 14 months give 3 windows.
const growth = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200];
const points = [
  ...growth.map((bp, k) => ({
    date: `2025-${String(k + 1).padStart(2, "0")}-28`,
    value: 1,
    flows: 0,
    return_bp: bp,
  })),
  { date: "2026-01-28", value: 1, flows: 0, return_bp: 1100 },
  { date: "2026-02-28", value: 1, flows: 0, return_bp: 1400 },
];

const series = (indexes: unknown[] = []) =>
  ({
    from: "2025-01-02",
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
    expect(got.extremes?.last.end).toBe("2026-02");
    expect(got.negative).toEqual({ count: 0, share: 0 });
    expect(got.months).toBe(14);
    expect(got.firstClose).toBe("2026-01-02");
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

  it("has no extremes under 12 months and closes the first window a year after the start", () => {
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
