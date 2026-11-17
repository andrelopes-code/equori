import { describe, expect, it } from "vitest";

import type { DraftBucket } from "@/features/planning/income-split/bucket-draft";
import {
  potColor,
  splitBar,
  sumState,
} from "@/features/planning/income-split/dialog/split-bar";

describe("splitBar", () => {
  it.each([
    {
      name: "a whole split has no rest",
      shares: ["60", "40"],
      segments: [6000, 4000],
      rest: 0,
    },
    {
      name: "a split below the whole leaves the missing share",
      shares: ["50", "40"],
      segments: [5000, 4000],
      rest: 1000,
    },
    {
      name: "a split above the whole has no rest",
      shares: ["70", "40"],
      segments: [7000, 4000],
      rest: 0,
    },
    {
      name: "a share that is not a number draws nothing",
      shares: ["x", "40"],
      segments: [0, 4000],
      rest: 6000,
    },
  ])("$name", ({ shares, segments, rest }) => {
    const bar = splitBar(buckets(shares));

    expect(bar.segments.map((s) => s.bp)).toEqual(segments);
    expect(bar.segments.map((s) => s.number)).toEqual([1, 2]);
    expect(bar.segments.map((s) => s.key)).toEqual(["b1", "b2"]);
    expect(bar.rest).toBe(rest);
  });
});

describe("potColor", () => {
  it.each([
    [1, 1],
    [8, 8],
    [9, 1],
    [10, 2],
  ])("gives bucket %i the colour %i", (number, colour) => {
    expect(potColor(number)).toBe(colour);
  });
});

describe("sumState", () => {
  it.each([
    { shares: ["60", "40"], state: { kind: "whole" } },
    {
      shares: ["57.5", "40"],
      state: { kind: "missing", total: 9750, off: 250 },
    },
    { shares: ["70", "40"], state: { kind: "over", total: 11000, off: 1000 } },
    { shares: ["x", "40"], state: { kind: "invalid" } },
  ])("reads $shares as $state.kind", ({ shares, state }) => {
    expect(sumState(buckets(shares))).toEqual(state);
  });
});

function buckets(shares: readonly string[]): DraftBucket[] {
  return shares.map((share, i) => ({
    key: `b${String(i + 1)}`,
    name: `Bucket ${String(i + 1)}`,
    share,
    measure: "ceiling",
  }));
}
