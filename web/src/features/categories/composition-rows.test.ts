import { expect, it } from "vitest";

import type { CategoryEntry } from "@/features/categories/category-paths";
import {
  childRows,
  compositionRows,
} from "@/features/categories/composition-rows";

it("ranks the groups of the last month and prints each share", () => {
  expect(
    compositionRows(
      [
        { field: "a", label: "Market" },
        { field: "b", label: "Diner" },
        { field: "c", label: "Bakery" },
      ],
      { a: 200, b: 600, c: 0, label: "Oct" },
      "en-US",
    ),
  ).toEqual([
    { id: "b", label: "Diner · 75.00%", amount: 600 },
    { id: "a", label: "Market · 25.00%", amount: 200 },
  ]);
});

it("carries the group id on each ranked bar", () => {
  expect(
    compositionRows([{ field: "g1", label: "Market" }], { g1: 200 }, "en-US"),
  ).toEqual([{ id: "g1", label: "Market · 100.00%", amount: 200 }]);
});

it("splits a group into its children and what it holds directly", () => {
  const entries = [
    entry("p", "Variable costs"),
    entry("a", "Market", "p"),
    entry("b", "Fuel", "p"),
    entry("c", "Rent"),
  ];
  const items = [
    total("p", 100, 1000),
    total("a", 600, 600),
    total("b", 300, 300),
    total("c", 0, 5000),
  ];

  expect(childRows(entries, items, "p", "Direct", "en-US")).toEqual([
    { id: "a", label: "Market · 60.00%", amount: 600 },
    { id: "b", label: "Fuel · 30.00%", amount: 300 },
    { id: "p", label: "Direct · 10.00%", amount: 100 },
  ]);
});

function entry(id: string, name: string, parentId?: string): CategoryEntry {
  return {
    id,
    name,
    path: name,
    depth: parentId === undefined ? 0 : 1,
    ...(parentId === undefined ? {} : { parentId }),
    class: "expense",
    archived: false,
    uncategorized: false,
  };
}

function total(id: string, own: number, subtree: number) {
  return {
    account_id: id,
    total: { amount: own, currency: "BRL" },
    subtree_total: { amount: subtree, currency: "BRL" },
  };
}
