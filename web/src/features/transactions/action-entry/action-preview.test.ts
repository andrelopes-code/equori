import { describe, expect, it } from "vitest";

import { actionPreview } from "@/features/transactions/action-entry/action-preview";

describe("actionPreview", () => {
  const cases = [
    // S431: a split of 1 for 10.
    {
      name: "split",
      held: 100,
      from: 1,
      to: 10,
      scale: 0,
      received: 1000,
      fraction: "0",
    },
    // S432: a reverse split of 10 for 1 leaves 5 of 10.
    {
      name: "reverse split",
      held: 15,
      from: 10,
      to: 1,
      scale: 0,
      received: 1,
      fraction: "0.5",
    },
    // S433: a bonus of 10 for 11.
    {
      name: "bonus",
      held: 100,
      from: 10,
      to: 11,
      scale: 0,
      received: 110,
      fraction: "0",
    },
    {
      name: "fewer than one unit",
      held: 5,
      from: 10,
      to: 1,
      scale: 0,
      received: 0,
      fraction: "0.5",
    },
    {
      name: "a scale of 2",
      held: 1505,
      from: 10,
      to: 1,
      scale: 2,
      received: 150,
      fraction: "0.005",
    },
    {
      name: "a repeating fraction",
      held: 1,
      from: 3,
      to: 1,
      scale: 0,
      received: 0,
      fraction: "0.333333333333",
    },
  ];

  it.each(cases)(
    "computes $name",
    ({ held, from, to, scale, received, fraction }) => {
      expect(actionPreview(held, from, to, scale)).toEqual({
        received,
        fraction,
      });
    },
  );

  it("returns null for a proportion that is not positive", () => {
    expect(actionPreview(100, 0, 10, 0)).toBeNull();
    expect(actionPreview(100, 1, 0, 0)).toBeNull();
  });
});
