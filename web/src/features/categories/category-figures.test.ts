import { describe, expect, it } from "vitest";

import {
  biggestRise,
  comparableBounds,
  daysCounted,
  lastMonths,
  monthBounds,
  previousMonth,
  projectMonth,
  summarize,
  trendOf,
} from "@/features/categories/category-figures";
import type { CategoryEntry } from "@/features/categories/category-paths";

function entry(id: string, over: Partial<CategoryEntry> = {}): CategoryEntry {
  return {
    id,
    name: id,
    path: id,
    depth: 0,
    class: "expense",
    archived: false,
    uncategorized: false,
    ...over,
  };
}

const money = (amount: number) => ({ amount, currency: "BRL" });
const item = (id: string, total: number, subtree: number = total) => ({
  account_id: id,
  total: money(total),
  subtree_total: money(subtree),
});

describe("daysCounted", () => {
  it.each([
    [
      "the day of the month so far in the current month",
      "2026-10",
      "2026-10-17",
      17,
    ],
    ["every day of a past month", "2026-09", "2026-10-17", 30],
    ["the 29 days of a leap February", "2028-02", "2028-03-05", 29],
    ["no day in a month that has not begun", "2026-11", "2026-10-17", 0],
  ])("counts %s", (_name, month, today, expected) => {
    expect(daysCounted(month, today)).toBe(expected);
  });
});

describe("previousMonth", () => {
  it.each([
    ["2026-10", "2026-09"],
    ["2026-01", "2025-12"],
  ])("the month before %s is %s", (month, expected) => {
    expect(previousMonth(month)).toBe(expected);
  });
});

describe("monthBounds", () => {
  it.each([
    ["2026-10", { from: "2026-10-01", to: "2026-10-31" }],
    ["2028-02", { from: "2028-02-01", to: "2028-02-29" }],
  ])("bounds %s", (month, expected) => {
    expect(monthBounds(month)).toEqual(expected);
  });
});

describe("summarize", () => {
  const entries = [
    entry("food"),
    entry("groceries", { parentId: "food", depth: 1 }),
    entry("fun"),
    entry("old", { archived: true }),
    entry("unc", { uncategorized: true, systemRole: "uncategorized_expense" }),
    entry("salary", { class: "income" }),
  ];
  const items = [
    item("food", 5000, 30000),
    item("groceries", 25000),
    item("fun", 10000),
    item("old", 2000),
    item("unc", 8000),
    item("salary", 90000),
  ];

  it("totals every top-level category of the class, archived and held spending included", () => {
    expect(summarize(entries, items, "expense").total).toBe(50000);
  });

  it("reads income as the positive earnings the server sends", () => {
    expect(summarize(entries, [item("salary", 90000)], "income").total).toBe(
      90000,
    );
  });

  it("lists the top-level groups largest first, without the holder or empty groups", () => {
    const { groups } = summarize(
      entries,
      [...items, item("empty", 0)],
      "expense",
    );
    expect(groups.map((g) => [g.entry.id, g.amount])).toEqual([
      ["food", 30000],
      ["fun", 10000],
      ["old", 2000],
    ]);
  });

  it("is empty before the totals arrive", () => {
    expect(summarize(entries, undefined, "expense")).toEqual({
      total: 0,
      groups: [],
    });
  });
});

describe("lastMonths", () => {
  it("lists the months ending at the one given, oldest first", () => {
    expect(lastMonths("2026-02", 4)).toEqual([
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });
});

describe("trendOf", () => {
  const entries = [
    entry("food", { color: 2 }),
    entry("fun", { color: 3 }),
    entry("unc", { uncategorized: true, systemRole: "uncategorized_expense" }),
  ];
  const months = [
    {
      month: "2026-08",
      items: [item("food", 100), item("fun", 500), item("unc", 50)],
    },
    { month: "2026-09", items: [item("food", 300), item("unc", 10)] },
    { month: "2026-10", items: undefined },
  ];

  it("gives one record per month with the amount of each group and of the held spending", () => {
    expect(trendOf(entries, months, "expense").records).toEqual([
      { month: "2026-08", food: 100, fun: 500, pending: 50 },
      { month: "2026-09", food: 300, fun: 0, pending: 10 },
      { month: "2026-10", food: 0, fun: 0, pending: 0 },
    ]);
  });

  it("orders the groups by what they spent over the months, largest first", () => {
    expect(
      trendOf(entries, months, "expense").groups.map((g) => [
        g.id,
        g.name,
        g.color,
      ]),
    ).toEqual([
      ["fun", "fun", 3],
      ["food", "food", 2],
    ]);
  });

  it("leaves a group out that never spent in the months", () => {
    expect(
      trendOf([...entries, entry("idle")], months, "expense").groups.map(
        (g) => g.id,
      ),
    ).toEqual(["fun", "food"]);
  });
});

describe("comparableBounds", () => {
  it.each([
    [
      "the same days of the month before while the month is running",
      "2026-10",
      "2026-10-17",
      { from: "2026-09-01", to: "2026-09-17" },
    ],
    [
      "the days the month before had when it is shorter",
      "2026-03",
      "2026-03-30",
      { from: "2026-02-01", to: "2026-02-28" },
    ],
    [
      "the whole month before once the month is over",
      "2026-09",
      "2026-10-17",
      { from: "2026-08-01", to: "2026-08-31" },
    ],
    [
      "the whole month before when the last day is today",
      "2026-10",
      "2026-10-31",
      { from: "2026-09-01", to: "2026-09-30" },
    ],
  ])("is %s", (_name, month, today, expected) => {
    expect(comparableBounds(month, today)).toEqual(expected);
  });
});

describe("projectMonth", () => {
  it("carries the pace so far over the whole month, rounded to a minor unit", () => {
    expect(projectMonth(40000, 17, 31)).toBe(72941);
  });

  it("has no pace before a day has gone by", () => {
    expect(projectMonth(0, 0, 30)).toBeUndefined();
  });
});

describe("biggestRise", () => {
  const food = entry("food");
  const fun = entry("fun");
  const group = (e: CategoryEntry, amount: number) => ({ entry: e, amount });
  const summary = (...groups: ReturnType<typeof group>[]) => ({
    total: groups.reduce((sum, g) => sum + g.amount, 0),
    groups,
  });

  it("names the group that grew most since the period before, with the growth", () => {
    expect(
      biggestRise(
        summary(group(food, 30000), group(fun, 10000)),
        summary(group(food, 25000), group(fun, 2000)),
      ),
    ).toEqual({ entry: fun, amount: 8000 });
  });

  it("counts a group the period before did not have as growth from nothing", () => {
    expect(
      biggestRise(
        summary(group(food, 30000), group(fun, 10000)),
        summary(group(food, 30000)),
      ),
    ).toEqual({ entry: fun, amount: 10000 });
  });

  it("is undefined when nothing grew", () => {
    expect(
      biggestRise(summary(group(food, 20000)), summary(group(food, 25000))),
    ).toBeUndefined();
  });

  it("is undefined without a period before to compare with", () => {
    expect(biggestRise(summary(group(food, 20000)), undefined)).toBeUndefined();
    expect(biggestRise(summary(group(food, 20000)), summary())).toBeUndefined();
  });
});
