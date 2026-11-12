import { describe, expect, it } from "vitest";

import { redistributeTargets } from "@/features/portfolio/contribution-plan/model/redistribute-targets";

describe("redistributeTargets", () => {
  const none = (n: number) => Array.from({ length: n }, () => false);

  it.each([
    {
      name: "spreads a rise over the others, the extra unit on the first",
      targets: [4000, 2000, 2000, 2000],
      locked: none(4),
      index: 0,
      next: 5000,
      want: [5000, 1666, 1667, 1667],
    },
    {
      name: "keeps a locked target",
      targets: [4000, 2000, 2000, 2000],
      locked: [false, false, false, true],
      index: 0,
      next: 5000,
      want: [5000, 1500, 1500, 2000],
    },
    {
      name: "gives a fall to the others in proportion to their targets",
      targets: [5000, 5000, 0],
      locked: none(3),
      index: 1,
      next: 0,
      want: [10000, 0, 0],
    },
    {
      name: "takes a rise from the others in proportion to their targets",
      targets: [5000, 5000, 0],
      locked: none(3),
      index: 2,
      next: 10000,
      want: [0, 0, 10000],
    },
    {
      name: "returns the targets unchanged when every other is locked",
      targets: [4000, 3000, 3000],
      locked: [false, true, true],
      index: 0,
      next: 9000,
      want: [4000, 3000, 3000],
    },
    {
      name: "gives a fall in equal parts when every other is zero",
      targets: [10000, 0, 0],
      locked: none(3),
      index: 0,
      next: 4000,
      want: [4000, 3000, 3000],
    },
    {
      name: "clamps a negative value to zero",
      targets: [5000, 5000],
      locked: none(2),
      index: 0,
      next: -300,
      want: [0, 10000],
    },
    {
      name: "clamps above the room left by the locked targets",
      targets: [4000, 3000, 3000],
      locked: [false, false, true],
      index: 0,
      next: 9000,
      want: [7000, 0, 3000],
    },
  ])("$name", ({ targets, locked, index, next, want }) => {
    const got = redistributeTargets(targets, locked, index, next);

    expect(got).toEqual(want);
  });
});
