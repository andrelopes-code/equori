import { describe, expect, it } from "vitest";

import { written } from "@/features/calculators/model/calculators";
import { screens } from "@/features/calculators/pages/calculator-page";

describe("written", () => {
  it("holds the eleven ids the calculator page draws", () => {
    expect([...written].sort()).toEqual(Object.keys(screens).sort());
    expect(written.size).toBe(11);
    expect(written.has("reserve")).toBe(false);
    expect(written.has("independence")).toBe(false);
  });
});
