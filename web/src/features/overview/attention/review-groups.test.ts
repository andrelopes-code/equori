import { describe, expect, it } from "vitest";

import type { ReviewSegment } from "@/features/overview/attention/attention";
import { reviewGroups } from "@/features/overview/attention/review-groups";

const segment = (count: number): ReviewSegment => ({
  kind: "uncategorized",
  count,
});

describe("reviewGroups", () => {
  it("keeps up to four sources as they are", () => {
    const groups = reviewGroups([
      segment(5),
      segment(4),
      segment(3),
      segment(2),
    ]);
    expect(groups.map((g) => [g.segments.length, g.count])).toEqual([
      [1, 5],
      [1, 4],
      [1, 3],
      [1, 2],
    ]);
  });

  it("gathers every source past the third into one group", () => {
    const groups = reviewGroups([
      segment(9),
      segment(8),
      segment(7),
      segment(2),
      segment(1),
    ]);
    expect(groups.map((g) => [g.segments.length, g.count])).toEqual([
      [1, 9],
      [1, 8],
      [1, 7],
      [2, 3],
    ]);
  });

  it("is empty without sources", () => {
    expect(reviewGroups([])).toEqual([]);
  });
});
