import { describe, expect, it } from "vitest";

import type { PlanGroup } from "@/features/planning/budget-plan/plan-groups";
import { planSegments } from "@/features/planning/budget-plan/plan-segments";

const names = { installments: "I", savings: "S", rest: "R", over: "O" };

function group(id: string, draft: number): PlanGroup {
  return { id, name: id, lines: [], draft, lastMonth: 0, average: 0 };
}

describe("planSegments", () => {
  it("lists the commitments, the groups by size and the rest", () => {
    const got = planSegments(
      100,
      200,
      [group("a", 50), group("b", 300), group("c", 0)],
      400,
      names,
    );

    expect(got.map((s) => [s.key, s.amount, s.tone])).toEqual([
      ["installments", 100, "commitment"],
      ["savings", 200, "commitment"],
      ["b", 300, "data-1"],
      ["a", 50, "data-2"],
      ["rest", 400, "rest"],
    ]);
  });

  it("draws the excess and leaves out zero commitments", () => {
    const got = planSegments(0, 0, [], -25, names);

    expect(got).toEqual([{ key: "over", name: "O", amount: 25, tone: "over" }]);
  });
});
