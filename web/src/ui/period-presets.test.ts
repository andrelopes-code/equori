import { describe, expect, it } from "vitest";

import {
  periodKind,
  periodLabel,
  periodPresets,
  stepPeriod,
} from "@/ui/period-presets";

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
    ["2025-12-20", "2026-01-05", "20/12/2025 – 05/01/2026"],
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
