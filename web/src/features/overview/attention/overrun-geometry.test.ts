import { describe, expect, it } from "vitest";

import { overrunGeometry } from "@/features/overview/attention/overrun-geometry";

describe("overrunGeometry", () => {
  it("ends the overrun at the spent amount, with the headroom", () => {
    // length = 148000 * 1.06 = 156880.
    const g = overrunGeometry(120000, 148000);
    expect(g.room).toBeCloseTo(76.49, 2);
    expect(g.overrun).toBeCloseTo(17.85, 2);
    expect(g.room + g.overrun).toBeCloseTo(94.34, 2);
  });

  it("draws the whole bar as overrun when there is no room", () => {
    const g = overrunGeometry(0, 500);
    expect(g.room).toBe(0);
    expect(g.overrun).toBeCloseTo(94.34, 2);
  });
});
