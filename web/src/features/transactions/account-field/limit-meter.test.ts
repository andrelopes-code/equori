import { describe, expect, it } from "vitest";

import {
  litSegments,
  meterSegments,
} from "@/features/transactions/account-field/limit-meter";

describe("litSegments", () => {
  const cases: [number | undefined, number | undefined, number | null][] = [
    [3000000, 2233701, 4],
    [1500000, 1123839, 4],
    [100000, 15000, 12],
    [1000000, 1000000, 0],
    [1000000, 0, 14],
    [1000000, 1200000, 0],
    [0, 0, null],
    [undefined, 100, null],
    [100, undefined, null],
  ];

  it.each(cases)("limit %s free %s lights %s", (limit, free, expected) => {
    expect(litSegments(limit, free)).toBe(expected);
  });

  it("draws fourteen segments", () => {
    expect(meterSegments).toBe(14);
  });
});
