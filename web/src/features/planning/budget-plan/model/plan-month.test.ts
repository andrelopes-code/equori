import { describe, expect, it } from "vitest";

import {
  firstNextChange,
  previousMonth,
} from "@/features/planning/budget-plan/model/plan-month";

describe("previousMonth", () => {
  it.each([
    ["2026-11", "2026-10"],
    ["2026-01", "2025-12"],
    ["2026-10", "2026-09"],
  ])("%s follows %s", (month, want) => {
    expect(previousMonth(month)).toBe(want);
  });
});

describe("firstNextChange", () => {
  it("takes the earliest change of a changed row", () => {
    const row = (draft: number, planned: number, next?: string) => ({
      draft,
      planned: { amount: planned },
      ...(next === undefined ? {} : { next_change: next }),
    });

    expect(
      firstNextChange([
        row(1, 1, "2026-12"),
        row(2, 1, "2027-03"),
        row(3, 1, "2027-02"),
        row(4, 1),
      ]),
    ).toBe("2027-02");
    expect(firstNextChange([row(1, 1, "2026-12")])).toBeUndefined();
  });
});
