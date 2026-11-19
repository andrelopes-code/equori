import { describe, expect, it } from "vitest";

import {
  correctionAnswer,
  monthsStatus,
} from "@/features/calculators/correction-calculator/correction-answer";

const stored = { first: "2020-01", last: "2020-12" };

describe("monthsStatus", () => {
  const cases = [
    {
      name: "months inside the stored ones",
      from: "2020-01",
      to: "2020-12",
      want: "inside",
    },
    {
      name: "a start after the end",
      from: "2020-12",
      to: "2020-01",
      want: "order",
    },
    {
      name: "a start before the stored months",
      from: "2019-06",
      to: "2020-12",
      want: "range",
    },
    {
      name: "an end after the stored months",
      from: "2020-01",
      to: "2021-01",
      want: "range",
    },
    { name: "no month yet", from: null, to: null, want: "unknown" },
  ] as const;

  it.each(cases)("$name", ({ from, to, want }) => {
    expect(monthsStatus(from, to, stored.first, stored.last)).toBe(want);
  });

  it("is unknown without stored months", () => {
    expect(monthsStatus("2020-01", "2020-02", undefined, undefined)).toBe(
      "unknown",
    );
  });
});

describe("correctionAnswer", () => {
  const rates = [
    { date: "2020-01-01", rate: 0.01 },
    { date: "2020-02-01", rate: 0.02 },
  ];

  it("multiplies the amount by the accumulated factor and counts the months", () => {
    expect(correctionAnswer(100000, rates)).toEqual({
      corrected: 103020,
      change: 1.01 * 1.02 - 1,
      months: 2,
    });
  });

  it("counts a daily index by its distinct months", () => {
    const daily = [
      { date: "2020-01-02", rate: 0 },
      { date: "2020-01-03", rate: 0 },
      { date: "2020-02-03", rate: 0 },
    ];

    expect(correctionAnswer(500, daily)?.months).toBe(2);
  });

  it("returns null without an amount or without rates", () => {
    expect(correctionAnswer(null, rates)).toBeNull();
    expect(correctionAnswer(100, undefined)).toBeNull();
    expect(correctionAnswer(100, [])).toBeNull();
  });
});
