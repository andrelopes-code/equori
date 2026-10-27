import { describe, expect, it } from "vitest";

import {
  convertMonthsText,
  readDays,
  readMonths,
} from "@/features/calculators/duration";

describe("readMonths", () => {
  it.each([
    ["30", "year", 360],
    ["1.5", "year", 18],
    ["1.3", "year", null],
    ["360", "month", 360],
    ["0", "year", null],
    ["51", "year", null],
  ] as const)("reads %s %s as %s months", (text, unit, want) => {
    expect(readMonths(text, unit, 1, 600)).toBe(want);
  });
});

describe("readDays", () => {
  it.each([
    ["730", "day", "2026-10-27", 730],
    ["2", "year", "2025-03-01", 730],
    ["2", "year", "2027-10-27", 731],
    ["1", "month", "2026-01-31", 28],
    ["12", "month", "2026-10-27", 365],
    ["1.5", "year", "2026-10-27", null],
  ] as const)("reads %s %s from %s as %s days", (text, unit, today, want) => {
    expect(readDays(text, unit, today, 36500)).toBe(want);
  });
});

describe("convertMonthsText", () => {
  it.each([
    ["360", "month", "year", "30"],
    ["100", "month", "year", "100"],
    ["2.5", "year", "month", "30"],
    ["", "month", "year", ""],
  ] as const)("turns %s %s into %s %s", (text, from, to, want) => {
    expect(convertMonthsText(text, from, to)).toBe(want);
  });
});
