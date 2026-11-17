import { describe, expect, it } from "vitest";

import {
  upcomingView,
  upcomingWindow,
} from "@/features/overview/upcoming/upcoming";

const occ = (id: string, expected_on: string, state: string) => ({
  id,
  expected_on,
  state: state as "expected" | "overdue" | "realized" | "skipped",
});

describe("upcomingWindow", () => {
  it("keeps overdue occurrences and the open ones of the next 7 days, by date", () => {
    const rows = upcomingWindow(
      [
        occ("future", "2026-10-25", "expected"),
        occ("last", "2026-10-24", "expected"),
        occ("today", "2026-10-17", "expected"),
        occ("late", "2026-09-05", "overdue"),
        occ("done", "2026-10-18", "realized"),
        occ("skipped", "2026-10-19", "skipped"),
      ],
      "2026-10-17",
    );
    expect(rows.map((r) => r.id)).toEqual(["late", "today", "last"]);
  });
});

describe("upcomingView", () => {
  it("groups the overdue apart, marks deadline and direction, and totals by currency", () => {
    const view = upcomingView(occurrences, schedules, "2026-11-17", "BRL");

    expect(view.late.map((e) => e.occurrence.id)).toEqual(["1", "2"]);
    expect(view.lateSum).toBe(240000);
    expect(view.next.map((e) => e.occurrence.id)).toEqual([
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
    ]);
    expect(view.until).toBe("2026-11-24");
    expect(view.leaving).toEqual([
      { amount: 284480, currency: "BRL" },
      { amount: 2000, currency: "USD" },
    ]);
    expect(view.entering).toEqual([{ amount: 1133497, currency: "BRL" }]);
  });

  it("describes each entry", () => {
    const view = upcomingView(occurrences, schedules, "2026-11-17", "BRL");
    const facts = [...view.late, ...view.next].map((e) => [
      e.occurrence.id,
      e.name,
      e.days,
      e.deadline,
      e.direction,
      e.repeated,
      e.today,
    ]);

    expect(facts).toEqual([
      ["1", "Rent", -12, "overdue", "out", false, false],
      ["2", "Tax", -7, "overdue", "out", false, false],
      ["3", "Streaming", -3, "late", "out", false, false],
      ["4", "Salary", 0, "ahead", "in", false, true],
      ["5", "Internet", 1, "ahead", "out", false, false],
      ["6", "Power", 1, "ahead", "out", true, false],
      ["7", "Reserve", 5, "ahead", "none", false, false],
      ["8", undefined, 7, "ahead", "out", false, false],
    ]);
  });

  it("holds no total and no group without rows", () => {
    const view = upcomingView([], [], "2026-11-17", "BRL");

    expect(view).toEqual({
      late: [],
      lateSum: 0,
      next: [],
      until: "2026-11-24",
      leaving: [],
      entering: [],
    });
  });
});

const schedules = [
  { id: "rent", description: "Rent", kind: "bill" as const },
  { id: "tax", description: "Tax", kind: "bill" as const },
  { id: "streaming", description: "Streaming", kind: "subscription" as const },
  { id: "salary", description: "Salary", kind: "income" as const },
  { id: "internet", description: "Internet", kind: "bill" as const },
  { id: "power", description: "Power", kind: "bill" as const },
  { id: "reserve", description: "Reserve", kind: "savings" as const },
  { id: "blank", description: "", kind: "transfer" as const },
];

const due = (
  id: string,
  schedule_id: string,
  expected_on: string,
  amount: number,
  state: "expected" | "overdue" = "expected",
  currency = "BRL",
) => ({
  id,
  schedule_id,
  expected_on,
  state,
  expected_amount: { amount, currency },
});

// Today is 2026-11-17. Leaving in BRL: 240000 + 5990 + 11990 + 22000 + 4500 = 284480.
const occurrences = [
  due("9", "rent", "2026-11-25", 240000),
  due("8", "gone", "2026-11-24", 4500),
  due("7", "reserve", "2026-11-22", 100000),
  due("6", "power", "2026-11-18", 22000),
  due("5", "internet", "2026-11-18", 11990),
  due("4", "salary", "2026-11-17", 1133497),
  due("3", "streaming", "2026-11-14", 5990),
  due("2", "tax", "2026-11-10", 2000, "overdue", "USD"),
  due("1", "rent", "2026-11-05", 240000, "overdue"),
];
