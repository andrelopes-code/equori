import { describe, expect, it } from "vitest";

import { accruedBp, faceText } from "@/features/instruments/accrual";

describe("faceText", () => {
  it.each([
    [1200000, 2, "12000.00"],
    [100000, 2, "1000.00"],
    [5, 2, "0.05"],
    [750, 0, "750"],
  ])("writes %i at scale %i as %s", (face, scale, text) => {
    expect(faceText(face, scale)).toBe(text);
  });
});

describe("accruedBp", () => {
  it("reads the price over the face value", () => {
    expect(accruedBp(1200000, 2, "15998.473131166787")).toBe(3332);
    expect(accruedBp(100000, 2, "1000.00")).toBe(0);
    expect(accruedBp(100000, 2, "990")).toBe(-100);
  });

  it("has no accrual from a face value of zero", () => {
    expect(accruedBp(0, 2, "10")).toBeNull();
  });
});
