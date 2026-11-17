import { describe, expect, it } from "vitest";

import {
  holdsToday,
  periodKind,
  periodLabel,
  periodPresets,
  periodWidest,
  stepPeriod,
} from "@/ui/navigation/period-presets";

describe("periodPresets", () => {
  it("computes each period from today", () => {
    expect(
      periodPresets("2026-03-15").map(({ key, from, to }) => ({
        key,
        from,
        to,
      })),
    ).toEqual([
      { key: "this-month", from: "2026-03-01", to: "2026-03-31" },
      { key: "last-month", from: "2026-02-01", to: "2026-02-28" },
      { key: "last-30-days", from: "2026-02-14", to: "2026-03-15" },
      { key: "last-90-days", from: "2025-12-16", to: "2026-03-15" },
      { key: "this-year", from: "2026-01-01", to: "2026-12-31" },
      { key: "last-year", from: "2025-01-01", to: "2025-12-31" },
    ]);
  });

  it("steps back across a year for last month in January", () => {
    const last = periodPresets("2026-01-10").find(
      (p) => p.key === "last-month",
    );
    expect(last).toMatchObject({ from: "2025-12-01", to: "2025-12-31" });
  });
});

describe("periodKind", () => {
  it.each([
    ["2026-02-01", "2026-02-28", "month"],
    ["2024-02-01", "2024-02-29", "month"],
    ["2026-01-01", "2026-12-31", "year"],
    ["2026-02-01", "2026-03-31", "range"],
    ["2026-02-02", "2026-02-28", "range"],
  ])("reads %s to %s as a %s", (from, to, kind) => {
    expect(periodKind(from, to)).toBe(kind);
  });
});

describe("stepPeriod", () => {
  it("moves a month by a month, across the year", () => {
    expect(stepPeriod("2026-01-01", "2026-01-31", -1)).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
    expect(stepPeriod("2026-01-01", "2026-01-31", 1)).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
  });

  it("moves a year by a year", () => {
    expect(stepPeriod("2026-01-01", "2026-12-31", -1)).toEqual({
      from: "2025-01-01",
      to: "2025-12-31",
    });
  });

  it("moves any other run by its own length", () => {
    expect(stepPeriod("2026-03-01", "2026-03-10", 1)).toEqual({
      from: "2026-03-11",
      to: "2026-03-20",
    });
    expect(stepPeriod("2026-03-01", "2026-03-10", -1)).toEqual({
      from: "2026-02-19",
      to: "2026-02-28",
    });
  });
});

describe("periodLabel", () => {
  it.each([
    ["2026-10-01", "2026-10-31", "Outubro de 2026"],
    ["2025-01-01", "2025-12-31", "2025"],
    ["2026-10-01", "2026-10-10", "1 out – 10 out"],
    // PC5 of docs/specs/2026-11-17-period-controls-design.md: two-digit years.
    ["2025-12-20", "2026-01-05", "20/12/25 – 05/01/26"],
  ])("names %s to %s as %s", (from, to, label) => {
    expect(periodLabel(from, to, "2026-10-21", "pt-BR")).toBe(label);
  });
});

describe("quarters", () => {
  it("adds the quarter of today and the one before only when asked", () => {
    const keys = (quarters: boolean) =>
      periodPresets("2026-01-10", quarters).map((p) => p.key);
    expect(keys(false)).not.toContain("this-quarter");
    expect(keys(true)).toEqual([
      "this-month",
      "last-month",
      "this-quarter",
      "last-quarter",
      "last-30-days",
      "last-90-days",
      "this-year",
      "last-year",
    ]);
    const quarter = (key: string) =>
      periodPresets("2026-01-10", true).find((p) => p.key === key);
    expect(quarter("this-quarter")).toMatchObject({
      from: "2026-01-01",
      to: "2026-03-31",
    });
    expect(quarter("last-quarter")).toMatchObject({
      from: "2025-10-01",
      to: "2025-12-31",
    });
  });

  it("reads a whole calendar quarter and steps it by a quarter", () => {
    expect(periodKind("2026-10-01", "2026-12-31")).toBe("quarter");
    expect(stepPeriod("2026-10-01", "2026-12-31", 1)).toEqual({
      from: "2027-01-01",
      to: "2027-03-31",
    });
    expect(stepPeriod("2026-01-01", "2026-03-31", -1)).toEqual({
      from: "2025-10-01",
      to: "2025-12-31",
    });
  });
});

describe("periodWidest", () => {
  it("lists the twelve months of the year for a month", () => {
    const widest = periodWidest("2026-10-01", "2026-10-31", "2026-10-17", "en");

    expect(widest).toHaveLength(12);
    expect(widest[0]).toBe("January 2026");
    expect(widest[8]).toBe("September 2026");
  });

  it("lists a two-digit day in each month for a run of days", () => {
    const widest = periodWidest("2026-10-01", "2026-10-10", "2026-10-17", "en");

    expect(widest).toHaveLength(12);
    expect(widest[8]).toBe(
      periodLabel("2026-09-28", "2026-09-28", "2026-10-17", "en"),
    );
  });

  it("lists nothing for a year", () => {
    expect(
      periodWidest("2026-01-01", "2026-12-31", "2026-10-17", "en"),
    ).toEqual([]);
  });
});

describe("holdsToday", () => {
  it.each([
    ["2026-10-01", "2026-10-31", "2026-10-01", true],
    ["2026-10-01", "2026-10-31", "2026-10-31", true],
    ["2026-10-01", "2026-10-31", "2026-11-01", false],
    ["2026-10-01", "2026-10-31", "2026-09-30", false],
  ])("%s to %s on %s is %s", (from, to, today, expected) => {
    expect(holdsToday(from, to, today)).toBe(expected);
  });
});
