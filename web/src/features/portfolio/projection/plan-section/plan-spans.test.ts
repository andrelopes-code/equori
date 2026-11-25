import { describe, expect, it } from "vitest";

import { planSpans } from "@/features/portfolio/projection/plan-section/plan-spans";

describe("planSpans", () => {
  it.each([
    {
      name: "the years before and after the withdrawals",
      age: 32,
      withdrawal: "55",
      last: "90",
      spans: { started: false, before: 23, after: 35 },
    },
    {
      name: "a plan whose withdrawals started, from today",
      age: 32,
      withdrawal: "30",
      last: "120",
      spans: { started: true, before: 0, after: 88 },
    },
    {
      name: "withdrawals that start today",
      age: 32,
      withdrawal: "32",
      last: "33",
      spans: { started: true, before: 0, after: 1 },
    },
  ])("PX17: $name", ({ age, withdrawal, last, spans }) => {
    expect(planSpans(age, withdrawal, last)).toEqual(spans);
  });

  it.each([
    { name: "no age", age: null, withdrawal: "55", last: "90" },
    { name: "an empty age", age: 32, withdrawal: "", last: "90" },
    { name: "a decimal age", age: 32, withdrawal: "55.5", last: "90" },
    { name: "a last age at the start", age: 32, withdrawal: "55", last: "55" },
    { name: "a last age at today", age: 32, withdrawal: "30", last: "32" },
  ])("PX17: is null for $name", ({ age, withdrawal, last }) => {
    expect(planSpans(age, withdrawal, last)).toBeNull();
  });
});
