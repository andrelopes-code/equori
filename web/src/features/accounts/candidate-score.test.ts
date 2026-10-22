import { describe, expect, it } from "vitest";

import { criteria } from "@/features/accounts/candidate-score";

describe("criteria", () => {
  it("adds back up to the score the server sent", () => {
    const candidate = {
      transaction_id: "t",
      score: 7,
      amount: "identical" as const,
      date: "far" as const,
      counterparty: "similar_description" as const,
    };
    const rows = criteria(candidate);
    expect(rows.map((r) => [r.points, r.max])).toEqual([
      [6, 6],
      [-1, 3],
      [2, 4],
    ]);
    expect(rows.reduce((sum, r) => sum + r.points, 0)).toBe(candidate.score);
  });
});
