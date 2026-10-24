import { describe, expect, it } from "vitest";

import type { CategoryEntry } from "@/features/categories";
import { categoryRows } from "@/features/reports/category-rows";

const money = (amount: number) => ({ amount, currency: "BRL" });
const entry = (
  id: string,
  name: string,
  parentId?: string,
  extra: Partial<CategoryEntry> = {},
): CategoryEntry => ({
  id,
  name,
  path: name,
  depth: parentId === undefined ? 0 : 1,
  class: "expense",
  archived: false,
  uncategorized: false,
  ...(parentId === undefined ? {} : { parentId }),
  ...extra,
});
const item = (id: string, total: number, subtree: number) => ({
  account_id: id,
  total: money(total),
  subtree_total: money(subtree),
});

const entries = [
  entry("food", "Food"),
  entry("market", "Market", "food"),
  entry("diner", "Diner", "food"),
  entry("fuel", "Fuel"),
  entry("pay", "Salary", undefined, { class: "income" }),
];
const items = [
  item("food", 1000, 9000),
  item("market", 5000, 5000),
  item("diner", 3000, 3000),
  item("fuel", 4000, 4000),
  item("pay", 100, 100),
];

describe("categoryRows", () => {
  it("lists the top-level categories of the class by subtree total", () => {
    const level = categoryRows(entries, items, undefined, "expense", undefined);
    expect(
      level.rows.map((r) => [r.id, r.subtree, r.own, r.hasChildren]),
    ).toEqual([
      ["food", 9000, 1000, true],
      ["fuel", 4000, 4000, false],
    ]);
    expect(level.total).toBe(13000);
  });

  it("lists the children of a category and what it holds itself", () => {
    const level = categoryRows(entries, items, undefined, "expense", "food");
    expect(level.rows.map((r) => [r.id, r.subtree])).toEqual([
      ["market", 5000],
      ["diner", 3000],
    ]);
    expect(level.direct?.subtree).toBe(1000);
    expect(level.total).toBe(9000);
  });

  it("sets each row against the previous period, with no percent for a zero base", () => {
    const before = [item("food", 0, 6000), item("fuel", 0, 0)];
    const level = categoryRows(entries, items, before, "expense", undefined);
    expect(
      level.rows.map((r) => [r.id, r.previous, r.change, r.changeBP]),
    ).toEqual([
      ["food", 6000, 3000, 5000],
      ["fuel", 0, 4000, undefined],
    ]);
    expect(level.previousTotal).toBe(6000);
  });

  it("keeps a category that only the previous period holds", () => {
    const before = [item("fuel", 0, 700)];
    const level = categoryRows(
      entries,
      [item("food", 0, 100)],
      before,
      "expense",
      undefined,
    );
    expect(level.rows.map((r) => r.id)).toEqual(["food", "fuel"]);
  });
});
