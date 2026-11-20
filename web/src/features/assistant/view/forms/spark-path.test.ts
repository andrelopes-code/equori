import { describe, expect, it } from "vitest";

import { sparkPath } from "@/features/assistant/view/forms/spark-path";

describe("sparkPath", () => {
  it("spans the box from the lowest to the highest value", () => {
    expect(sparkPath([10, 30, 20])).toBe("M0.0 22.0 L50.0 2.0 L100.0 12.0");
  });

  it("draws a flat series on the base line", () => {
    expect(sparkPath([5, 5])).toBe("M0.0 22.0 L100.0 22.0");
  });

  it("is empty without values", () => {
    expect(sparkPath([])).toBe("");
  });
});
