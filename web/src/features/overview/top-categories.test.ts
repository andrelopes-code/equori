import { describe, expect, it } from "vitest";

import { topCategories } from "@/features/overview/top-categories";

const item = (account_id: string, amount: number) => ({
  account_id,
  total: { amount, currency: "BRL" },
  subtree_total: { amount, currency: "BRL" },
});

describe("topCategories", () => {
  const names = new Map(
    ["a", "b", "c", "d", "e", "f", "g"].map((id) => [id, id.toUpperCase()]),
  );

  it("keeps the five largest totals, largest first", () => {
    const rows = topCategories(
      [
        item("a", 100),
        item("b", 700),
        item("c", 300),
        item("d", 500),
        item("e", 200),
        item("f", 600),
        item("g", 0),
      ],
      names,
    );
    expect(rows.map((r) => [r.name, r.amount])).toEqual([
      ["B", 700],
      ["F", 600],
      ["D", 500],
      ["C", 300],
      ["E", 200],
    ]);
  });

  it("breaks ties by name and leaves out zero and unnamed accounts", () => {
    const rows = topCategories(
      [item("b", 50), item("a", 50), item("g", 0), item("x", 90)],
      names,
    );
    expect(rows.map((r) => r.name)).toEqual(["A", "B"]);
  });
});
