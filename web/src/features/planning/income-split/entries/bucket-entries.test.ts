import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { entryGroups } from "@/features/planning/income-split/entries/bucket-entries";

type Entry = components["schemas"]["BudgetBucketEntry"];

function entry(
  id: string,
  kind: Entry["kind"],
  amount: number,
  categoryId?: string,
): Entry {
  return {
    transaction_id: id,
    kind,
    date: "2026-10-05",
    description: id,
    amount: { amount, currency: "BRL" },
    ...(categoryId === undefined ? {} : { category_id: categoryId }),
  };
}

describe("entryGroups", () => {
  it("groups by category, the largest total first, keeping the entry order", () => {
    const got = entryGroups([
      entry("a", "expense", 100, "c1"),
      entry("b", "expense", 300, "c2"),
      entry("c", "expense", 50, "c1"),
      entry("d", "savings", 200),
    ]);

    expect(got.map((g) => [g.key, g.kind, g.categoryId, g.total])).toEqual([
      ["c2", "expense", "c2", 300],
      ["savings", "savings", undefined, 200],
      ["c1", "expense", "c1", 150],
    ]);
    expect(got[2]?.entries.map((e) => e.transaction_id)).toEqual(["a", "c"]);
  });

  it("orders a tie by key ascending", () => {
    const got = entryGroups([
      entry("a", "expense", 100, "c2"),
      entry("b", "goals", 100),
      entry("c", "expense", 100, "c1"),
    ]);

    expect(got.map((g) => g.key)).toEqual(["c1", "c2", "goals"]);
  });

  it("returns no group without entries", () => {
    expect(entryGroups([])).toEqual([]);
  });
});
