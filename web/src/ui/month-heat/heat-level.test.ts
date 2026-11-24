import { describe, expect, it } from "vitest";

import { heatLevel } from "@/ui/month-heat/heat-level";

describe("heatLevel", () => {
  it.each([null, 0])("draws no strength for %s", (value) => {
    expect(heatLevel(value)).toBeNull();
  });

  it.each([
    [0.0099, 1],
    [0.01, 2],
    [0.0299, 2],
    [0.03, 3],
    [0.0599, 3],
    [0.06, 4],
  ])("takes the gain level of %s", (value, level) => {
    expect(heatLevel(value)).toEqual({ tone: "gain", level });
  });

  it.each([
    [-0.0099, 1],
    [-0.07, 4],
  ])("takes the loss level of %s", (value, level) => {
    expect(heatLevel(value)).toEqual({ tone: "loss", level });
  });

  it.each([
    [0.0199, 1],
    [0.02, 2],
    [0.05, 3],
    [0.1, 4],
  ])("takes the level of %s under the steps of its caller", (value, level) => {
    expect(heatLevel(value, [0.02, 0.05, 0.1])).toEqual({
      tone: "gain",
      level,
    });
  });
});
