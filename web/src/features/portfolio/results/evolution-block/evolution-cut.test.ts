import { describe, expect, it } from "vitest";

import { cutHistory } from "@/features/portfolio/results/evolution-block/evolution-cut";

const history = {
  from: "2025-10-01",
  to: "2025-12-31",
  currency: "BRL",
  opening: 0,
  points: [
    { date: "2025-10-31", value: 100000, flows: 100000 },
    { date: "2025-11-30", value: 101000, flows: 0 },
    { date: "2025-12-31", value: 203020, flows: 100000 },
  ],
  indexes: [],
};

describe("cutHistory", () => {
  // PR9: the whole history keeps every point and the opening of the series.
  it("keeps every point and the series opening for the whole history", () => {
    const cut = cutHistory(history, undefined, "2025-12-31");

    expect(cut.points.map((p) => p.date)).toEqual([
      "2025-10-31",
      "2025-11-30",
      "2025-12-31",
    ]);
    expect(cut.opening).toBe(0);
  });

  // PR9: the opening of a period is the value of the point before its first point.
  it("opens a period with the value of the point before it", () => {
    const cut = cutHistory(history, "2025-11-01", "2025-12-31");

    expect(cut.points.map((p) => p.date)).toEqual(["2025-11-30", "2025-12-31"]);
    expect(cut.opening).toBe(100000);
  });

  it("drops the points after the end of the period", () => {
    const cut = cutHistory(history, "2025-11-01", "2025-11-30");

    expect(cut.points.map((p) => p.date)).toEqual(["2025-11-30"]);
    expect(cut.opening).toBe(100000);
  });

  it("opens with the series opening when no point precedes the period", () => {
    const cut = cutHistory(
      { ...history, opening: 5000 },
      "2025-10-01",
      "2025-12-31",
    );

    expect(cut.points).toHaveLength(3);
    expect(cut.opening).toBe(5000);
  });
});
