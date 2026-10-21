import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  categoryEntries,
  orderForAmount,
  subtreeOf,
} from "@/features/categories/category-paths";

type Account = components["schemas"]["Account"];

function account(
  id: string,
  name: string,
  cls: Account["class"],
  extra: Partial<Account> = {},
): Account {
  return {
    id,
    name,
    class: cls,
    currency: "BRL",
    opened_on: "2026-01-01",
    yield_mode: "none",
    ...extra,
  };
}

const accounts: Account[] = [
  account("checking", "Itaú", "asset", { kind: "checking" }),
  account("food", "Food", "expense"),
  account("groceries", "Groceries", "expense", { parent_id: "food" }),
  account("bakery", "Bakery", "expense", {
    parent_id: "food",
    closed_on: "2026-09-30",
  }),
  account("auto", "Automóvel", "expense", { color: 3, icon: "car" }),
  account("salary", "Salary", "income"),
  account("unc-exp", "Uncategorized expense", "expense", {
    system_role: "uncategorized_expense",
  }),
  account("interest", "Interest", "income", { system_role: "interest" }),
];

describe("categoryEntries", () => {
  it("keeps income and expense accounts, expense first, by path", () => {
    const entries = categoryEntries(accounts, "en");
    expect(entries.map((e) => e.path)).toEqual([
      "Automóvel",
      "Food",
      "Food › Bakery",
      "Food › Groceries",
      "Uncategorized expense",
      "Interest",
      "Salary",
    ]);
  });

  it("states depth, archive, appearance and the uncategorized role", () => {
    const byId = new Map(categoryEntries(accounts, "en").map((e) => [e.id, e]));
    expect(byId.get("groceries")).toMatchObject({
      name: "Groceries",
      depth: 1,
      parentId: "food",
      archived: false,
      uncategorized: false,
    });
    expect(byId.get("bakery")?.archived).toBe(true);
    expect(byId.get("auto")).toMatchObject({ color: 3, icon: "car" });
    expect(byId.get("unc-exp")?.uncategorized).toBe(true);
    expect(byId.get("interest")?.uncategorized).toBe(false);
  });

  it("stops at a parent cycle instead of looping", () => {
    const cyclic = [
      account("a", "A", "expense", { parent_id: "b" }),
      account("b", "B", "expense", { parent_id: "a" }),
    ];
    const paths = categoryEntries(cyclic, "en").map((e) => e.path);
    expect(paths).toEqual(["A › B", "B › A"]);
  });
});

describe("orderForAmount", () => {
  const entries = categoryEntries(accounts, "en");

  it("leaves out archived and uncategorized categories", () => {
    const ids = orderForAmount(entries, -100).map((e) => e.id);
    expect(ids).not.toContain("bakery");
    expect(ids).not.toContain("unc-exp");
  });

  it("puts expense first for a negative amount and income first for a positive one", () => {
    expect(orderForAmount(entries, -100).map((e) => e.class)).toEqual([
      "expense",
      "expense",
      "expense",
      "income",
      "income",
    ]);
    expect(orderForAmount(entries, 100).map((e) => e.class)).toEqual([
      "income",
      "income",
      "expense",
      "expense",
      "expense",
    ]);
  });
});

describe("subtreeOf", () => {
  it("holds the category and every category under it", () => {
    const entries = categoryEntries(accounts, "en");
    expect([...subtreeOf(entries, "food")].sort()).toEqual([
      "bakery",
      "food",
      "groceries",
    ]);
    expect([...subtreeOf(entries, "salary")]).toEqual(["salary"]);
  });
});
