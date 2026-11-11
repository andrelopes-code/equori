import { describe, expect, it } from "vitest";

import { scaleDefault } from "@/features/instruments/define-instrument/scale-default";

// A223 RM9
describe("scaleDefault", () => {
  it.each([
    ["stock", 0],
    ["etf", 0],
    ["reit", 0],
    ["depositary_receipt", 0],
    ["fixed_income", 2],
    ["fund", 6],
    ["crypto", 8],
    ["currency", 2],
  ] as const)("is %s -> %i decimal places", (type, want) => {
    expect(scaleDefault(type)).toBe(want);
  });

  it("is null until a type is chosen", () => {
    expect(scaleDefault(null)).toBeNull();
  });
});
