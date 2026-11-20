import { describe, expect, it } from "vitest";

import {
  attributionFigures,
  barSpan,
} from "@/features/portfolio/attribution/attribution-rows";

// A holding whose weight is a tenth of its result and whose contribution is its result.
function item(instrument: string, amount: number, stale?: string) {
  return {
    instrument,
    result: { amount, currency: "BRL" },
    weight_bp: Math.abs(amount) / 10,
    contribution_bp: amount,
    ...(stale === undefined ? { return_bp: amount } : { stale_since: stale }),
  };
}

describe("attributionFigures", () => {
  it("draws every row of a short ranking", () => {
    const got = attributionFigures([item("A", 300), item("B", -100)]);

    expect(got.rows.map((r) => r.key)).toEqual(["A", "B"]);
    expect(got.gains).toEqual({ count: 1, sum: 300 });
    expect(got.losses).toEqual({ count: 1, sum: -100 });
    expect([got.low, got.high]).toEqual([-100, 300]);
  });

  it("adds the middle of a long ranking into one row and keeps a stale row apart", () => {
    // 13 items: 5 at each end, 3 between them, of which one is stale.
    const items = [
      ...[900, 800, 700, 600, 500].map((a, i) => item(`T${String(i)}`, a)),
      item("M0", 40),
      item("M1", 30, "2022-03-08"),
      item("M2", -20),
      ...[-100, -200, -300, -400, -500].map((a, i) => item(`B${String(i)}`, a)),
    ];

    const got = attributionFigures(items);

    expect(got.rows.map((r) => r.key)).toEqual([
      "T0",
      "T1",
      "T2",
      "T3",
      "T4",
      "others",
      "M1",
      "B0",
      "B1",
      "B2",
      "B3",
      "B4",
    ]);
    expect(got.rows[5]).toEqual({
      key: "others",
      others: 2,
      result: 20,
      weightBp: 6,
      contributionBp: 20,
    });
    expect(got.rows[6]?.staleSince).toBe("2022-03-08");
    expect(got.gains).toEqual({ count: 7, sum: 3570 });
    expect(got.losses).toEqual({ count: 6, sum: -1520 });
    expect([got.low, got.high]).toEqual([-500, 900]);
  });

  it("keeps a single middle row as itself", () => {
    const items = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map((a, i) =>
      item(`I${String(i)}`, a),
    );

    expect(attributionFigures(items).rows).toHaveLength(11);
  });

  it("starts the axis at zero when every result is a gain", () => {
    const got = attributionFigures([item("A", 50), item("B", 20)]);

    expect([got.low, got.high]).toEqual([0, 50]);
    expect(got.losses).toEqual({ count: 0, sum: 0 });
  });
});

describe("barSpan", () => {
  it("places a gain right of zero and a loss left of it", () => {
    expect(barSpan(-100, 300, 300)).toEqual({ zero: 25, start: 25, size: 75 });
    expect(barSpan(-100, 300, -100)).toEqual({ zero: 25, start: 0, size: 25 });
  });

  it("draws nothing on an empty axis", () => {
    expect(barSpan(0, 0, 0)).toEqual({ zero: 0, start: 0, size: 0 });
  });
});
