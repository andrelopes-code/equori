import { describe, expect, it } from "vitest";

import { ageAt } from "@/features/portfolio/projection/model/age-at";

describe("ageAt", () => {
  it.each([
    ["1994-03-10", "2026-03-09", 31],
    ["1994-03-10", "2026-03-10", 32],
    ["1994-03-10", "2026-12-31", 32],
    ["1994-03-10", "1994-03-10", 0],
  ])("is whole years from %s at %s", (birthDate, date, age) => {
    expect(ageAt(birthDate, date)).toBe(age);
  });
});
