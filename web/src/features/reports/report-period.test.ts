import { describe, expect, it } from "vitest";

import {
  defaultPeriod,
  kindOf,
  periodOfKind,
  previousPeriod,
  stepPeriod,
} from "@/features/reports/report-period";

describe("kindOf", () => {
  it.each([
    ["2026-10-01", "2026-10-31", "month"],
    ["2026-10-01", "2026-12-31", "quarter"],
    ["2026-01-01", "2026-03-31", "quarter"],
    ["2026-01-01", "2026-12-31", "year"],
    ["2026-02-01", "2026-03-31", "custom"],
    ["2026-10-02", "2026-12-31", "custom"],
  ] as const)("reads %s to %s as %s", (from, to, kind) => {
    expect(kindOf({ from, to })).toBe(kind);
  });
});

describe("periodOfKind", () => {
  it.each([
    ["month", { from: "2026-11-01", to: "2026-11-30" }],
    ["quarter", { from: "2026-10-01", to: "2026-12-31" }],
    ["year", { from: "2026-01-01", to: "2026-12-31" }],
  ] as const)("takes the %s around a day", (kind, period) => {
    expect(periodOfKind(kind, "2026-11-15")).toEqual(period);
  });

  it("ends February on its last day", () => {
    expect(periodOfKind("month", "2024-02-10")).toEqual({
      from: "2024-02-01",
      to: "2024-02-29",
    });
  });
});

describe("stepPeriod", () => {
  it("moves a quarter by a quarter across the year", () => {
    expect(stepPeriod({ from: "2026-01-01", to: "2026-03-31" }, -1)).toEqual({
      from: "2025-10-01",
      to: "2025-12-31",
    });
    expect(stepPeriod({ from: "2026-10-01", to: "2026-12-31" }, 1)).toEqual({
      from: "2027-01-01",
      to: "2027-03-31",
    });
  });

  it("moves a month and a year by their own kind", () => {
    expect(stepPeriod({ from: "2026-03-01", to: "2026-03-31" }, 1)).toEqual({
      from: "2026-04-01",
      to: "2026-04-30",
    });
    expect(stepPeriod({ from: "2026-01-01", to: "2026-12-31" }, -1)).toEqual({
      from: "2025-01-01",
      to: "2025-12-31",
    });
  });
});

describe("previousPeriod", () => {
  it("is the neighbouring month, quarter or year", () => {
    expect(previousPeriod({ from: "2026-10-01", to: "2026-10-31" })).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
  });

  it("is the run of the same length that ends the day before a custom period", () => {
    expect(previousPeriod({ from: "2026-03-11", to: "2026-03-20" })).toEqual({
      from: "2026-03-01",
      to: "2026-03-10",
    });
  });
});

it("opens on the month of today", () => {
  expect(defaultPeriod("2026-10-17")).toEqual({
    from: "2026-10-01",
    to: "2026-10-31",
  });
});
