import { describe, expect, it } from "vitest";

import { axisFloor } from "@/ui/axis-floor";

describe("axisFloor", () => {
  it.each([
    ["values far from zero", [9_300_000, 10_200_000, 9_000_000], 8_000_000],
    ["flat values", [500_000, 500_000], 480_000],
    ["values near zero", [20_000, 900_000], 0],
    ["a negative value", [-5_000, 900_000], undefined],
    ["no value", [], undefined],
    ["zero values", [0, 0], undefined],
  ])("fits the axis of %s", (_, values, floor) => {
    expect(axisFloor(values)).toBe(floor);
  });
});
