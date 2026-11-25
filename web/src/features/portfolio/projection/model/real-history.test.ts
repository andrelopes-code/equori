import { describe, expect, it } from "vitest";

import { realHistory } from "@/features/portfolio/projection/model/real-history";

const history = {
  from: "2025-11-01",
  to: "2026-02-15",
  currency: "BRL",
  opening: 10000,
  points: [
    { date: "2025-11-30", value: 11000, flows: 1000 },
    { date: "2025-12-31", value: 12500, flows: 500 },
    { date: "2026-02-15", value: 13000, flows: 300 },
  ],
  indexes: [
    {
      index: "cdi",
      period: "day" as const,
      points: [{ date: "2025-11-30", return_bp: 9000 }],
    },
    {
      index: "ipca",
      period: "month" as const,
      points: [
        { date: "2025-11-30", return_bp: 1000 },
        { date: "2025-12-31", return_bp: 2100 },
        { date: "2026-01-31", return_bp: 3200 },
      ],
    },
  ],
};

describe("realHistory", () => {
  it("PX13: corrects the recorded amounts to the last point of the inflation index", () => {
    // The index grew 1.32 in the period. The opening and the dates before its first point take all
    // of it; November takes 1.32 / 1.1 = 1.2; December 1.32 / 1.21 = 1.0909; February, after the
    // last point, takes nothing.
    const real = realHistory(history);

    expect(real?.opening).toBeCloseTo(13200, 6);
    expect(real?.points[0]?.value).toBeCloseTo(13200, 6);
    expect(real?.points[0]?.flows).toBeCloseTo(1200, 6);
    expect(real?.points[1]?.value).toBeCloseTo(13636.3636, 3);
    expect(real?.points[1]?.flows).toBeCloseTo(545.4545, 3);
    expect(real?.points[2]?.value).toBe(13000);
    expect(real?.points[2]?.flows).toBe(300);
  });

  it("PX13: is null without an inflation index", () => {
    expect(
      realHistory({ ...history, indexes: history.indexes.slice(0, 1) }),
    ).toBeNull();
  });
});
