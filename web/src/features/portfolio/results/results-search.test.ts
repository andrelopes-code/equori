import { describe, expect, it } from "vitest";

import { validateResultsSearch } from "@/features/portfolio/results/results-search";

const account = "3f2b0c1e-5a4d-4c8e-9b1a-2d3e4f5a6b7c";

describe("validateResultsSearch", () => {
  const cases: {
    name: string;
    raw: Record<string, unknown>;
    expected: Record<string, unknown>;
  }[] = [
    { name: "an empty search", raw: {}, expected: {} },
    {
      name: "every valid key",
      raw: { value_in: "USD", account, period: "12m" },
      expected: { value_in: "USD", account, period: "12m" },
    },
    { name: "an unknown period", raw: { period: "10y" }, expected: {} },
    {
      name: "a lone range bound",
      raw: { from: "2026-01-01" },
      expected: {},
    },
    {
      name: "a range beside a period",
      raw: { from: "2026-01-01", to: "2026-03-31", period: "12m" },
      expected: { from: "2026-01-01", to: "2026-03-31" },
    },
    {
      name: "a lower-case currency and a malformed account",
      raw: { value_in: "usd", account: "x" },
      expected: {},
    },
  ];

  it.each(cases)("keeps $name as its valid part", ({ raw, expected }) => {
    expect(validateResultsSearch(raw)).toEqual(expected);
  });
});
