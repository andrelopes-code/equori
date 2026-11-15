import { describe, expect, it } from "vitest";

import type { SeriesRow } from "@/features/assistant/message/answer-blocks";
import { seriesGeometry } from "@/features/assistant/message/series-geometry";
import type { SeriesGeometry } from "@/features/assistant/message/series-geometry";

describe("seriesGeometry", () => {
  it("steps after each row from zero to the highest value", () => {
    const geometry = geometryOf(
      rows([
        [0, 100],
        [5, 40],
        [10, 60],
      ]),
    );

    expect(geometry.line).toBe("M4,16 H190 V68.8 H376 V51.2");
    expect(geometry.area).toBe("M4,16 H190 V68.8 H376 V51.2 V104 H4 Z");
    expect(geometry.zeroY).toBe(104);
    expect(geometry.low).toEqual({ x: 190, y: 68.8, index: 1, text: "40" });
    expect(geometry.last).toEqual({ x: 376, y: 51.2 });
  });

  it("labels the first, lowest and last rows once each", () => {
    const middle = geometryOf(
      rows([
        [0, 100],
        [5, 40],
        [10, 60],
      ]),
    );
    const first = geometryOf(
      rows([
        [0, 10],
        [5, 40],
        [10, 60],
      ]),
    );

    expect(
      middle.labels.map(({ x, index, text, anchor }) => ({
        x,
        index,
        text,
        anchor,
      })),
    ).toEqual([
      { x: 4, index: 0, text: "0", anchor: "start" },
      { x: 190, index: 1, text: "5", anchor: "middle" },
      { x: 376, index: 2, text: "10", anchor: "end" },
    ]);
    expect(first.labels.map((label) => label.index)).toEqual([0, 2]);
  });

  it("draws the zero line inside a range that crosses zero", () => {
    const geometry = geometryOf(
      rows([
        [0, -50],
        [4, 100],
      ]),
    );

    expect(geometry.zeroY).toBeCloseTo(74.67, 2);
    expect(geometry.low.y).toBe(104);
  });

  it("draws no zero line when every value is negative", () => {
    const geometry = geometryOf(
      rows([
        [0, -10],
        [4, -20],
      ]),
    );

    expect(geometry.zeroY).toBeUndefined();
  });
});

function geometryOf(input: SeriesRow[]): SeriesGeometry {
  const geometry = seriesGeometry(input);
  if (geometry === undefined) throw new Error("no geometry");

  return geometry;
}

function rows(pairs: [number, number][]): SeriesRow[] {
  return pairs.map(([day, value]) => ({
    label: String(day),
    text: String(value),
    value,
    day,
  }));
}
