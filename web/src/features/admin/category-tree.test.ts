import { describe, expect, it } from "vitest";

import {
  categoryPath,
  categoryRows,
  topCategories,
} from "@/features/admin/category-tree";

const BRL = (amount: number) => ({ amount, currency: "BRL" });

const accounts = [
  { id: "home", name: "Home", parent_id: undefined },
  { id: "rent", name: "Rent", parent_id: "home" },
  { id: "power", name: "Power", parent_id: "home" },
  { id: "food", name: "Food", parent_id: undefined },
  { id: "market", name: "Market", parent_id: "food" },
];

const totals = [
  { account_id: "food", total: BRL(0), subtree_total: BRL(30000) },
  { account_id: "home", total: BRL(1000), subtree_total: BRL(201000) },
  { account_id: "market", total: BRL(30000), subtree_total: BRL(30000) },
  { account_id: "power", total: BRL(20000), subtree_total: BRL(20000) },
  { account_id: "rent", total: BRL(180000), subtree_total: BRL(180000) },
];

describe("categoryPath", () => {
  it("joins the names from the root to the category", () => {
    expect(categoryPath("rent", accounts)).toBe("Home › Rent");
    expect(categoryPath("food", accounts)).toBe("Food");
  });

  it("returns the id of a category it does not know", () => {
    expect(categoryPath("gone", accounts)).toBe("gone");
  });
});

describe("categoryRows", () => {
  it("orders each category under its parent, parents by name", () => {
    expect(categoryRows(totals, accounts)).toEqual([
      { category: "Food", total: BRL(0), subtree_total: BRL(30000) },
      {
        category: "Food › Market",
        total: BRL(30000),
        subtree_total: BRL(30000),
      },
      { category: "Home", total: BRL(1000), subtree_total: BRL(201000) },
      {
        category: "Home › Power",
        total: BRL(20000),
        subtree_total: BRL(20000),
      },
      {
        category: "Home › Rent",
        total: BRL(180000),
        subtree_total: BRL(180000),
      },
    ]);
  });
});

describe("topCategories", () => {
  it("lists the roots by their subtree total, largest first, without zeros", () => {
    expect(
      topCategories(
        [
          ...totals,
          { account_id: "idle", total: BRL(0), subtree_total: BRL(0) },
        ],
        [...accounts, { id: "idle", name: "Idle", parent_id: undefined }],
      ),
    ).toEqual([
      { category: "Home", amount: 201000, currency: "BRL" },
      { category: "Food", amount: 30000, currency: "BRL" },
    ]);
  });
});
