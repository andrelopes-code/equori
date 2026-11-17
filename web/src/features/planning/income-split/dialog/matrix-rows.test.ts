import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import type { CategoryEntry } from "@/features/categories";
import {
  expenseBranches,
  initialDraft,
  outsideChoice,
  sameChoice,
} from "@/features/planning/income-split/bucket-draft";
import {
  matrixRows,
  pickChoice,
} from "@/features/planning/income-split/dialog/matrix-rows";

type Bucket = components["schemas"]["BudgetBucket"];

describe("matrixRows", () => {
  it("lists the top-level categories with the subcategories of other buckets", () => {
    const rows = matrixRows(draft(), branches, parents, new Set());

    expect(rows.map((r) => r.entry.id)).toEqual(["food", "gym"]);
    expect(rows[0]).toMatchObject({
      depth: 0,
      at: "b1",
      follows: false,
      subcategories: 2,
      open: false,
      canOutside: true,
    });
    // market has its own bucket b2; bakery follows food.
    expect([...(rows[0]?.more ?? [])]).toEqual([["b2", 1]]);
    expect(rows[1]).toMatchObject({ at: outsideChoice, subcategories: 0 });
    expect([...(rows[1]?.more ?? [])]).toEqual([]);
  });

  it("lists the subcategories of an open category under it", () => {
    const rows = matrixRows(draft(), branches, parents, new Set(["food"]));

    expect(rows.map((r) => r.entry.id)).toEqual([
      "food",
      "bakery",
      "market",
      "gym",
    ]);
    expect(rows[0]?.open).toBe(true);
    expect(rows[1]).toMatchObject({
      depth: 1,
      at: "b1",
      follows: true,
      canOutside: false,
    });
    expect(rows[2]).toMatchObject({ depth: 1, at: "b2", follows: false });
  });

  it("offers no bucket to a subcategory only while its parent has none", () => {
    const outside = draft();
    outside.choices.set("food", outsideChoice);

    const rows = matrixRows(outside, branches, parents, new Set(["food"]));

    expect(rows[1]).toMatchObject({
      at: outsideChoice,
      follows: true,
      canOutside: true,
    });
    expect(rows[2]).toMatchObject({ at: "b2", canOutside: true });
  });
});

describe("pickChoice", () => {
  it.each([
    {
      name: "a top-level category takes the bucket of the column",
      id: "gym",
      column: "b2",
      expected: "b2",
    },
    {
      name: "a top-level category leaves the split",
      id: "food",
      column: outsideChoice,
      expected: outsideChoice,
    },
    {
      name: "a subcategory returns to its parent on the parent's column",
      id: "market",
      column: "b1",
      expected: sameChoice,
    },
    {
      name: "a subcategory takes a bucket of its own",
      id: "bakery",
      column: "b2",
      expected: "b2",
    },
    {
      name: "a subcategory stays while its parent has a bucket",
      id: "market",
      column: outsideChoice,
      expected: "b2",
    },
    {
      name: "the chosen column changes nothing",
      id: "food",
      column: "b1",
      expected: "b1",
    },
  ])("$name", ({ id, column, expected }) => {
    const choices = pickChoice(draft(), parents, id, column);

    expect(choices.get(id)).toBe(expected);
  });

  it("returns a subcategory to a parent without a bucket", () => {
    const outside = draft();
    outside.choices.set("food", outsideChoice);

    const choices = pickChoice(outside, parents, "market", outsideChoice);

    expect(choices.get("market")).toBe(sameChoice);
  });
});

const entries = [
  entry("food"),
  entry("bakery", "food"),
  entry("market", "food"),
  entry("gym"),
];
const branches = expenseBranches(entries);
const parents = new Map(entries.map((e) => [e.id, e.parentId]));
const stored: Bucket[] = [
  bucket("b1", 6000, ["food"]),
  bucket("b2", 4000, ["market"]),
];

function draft() {
  return initialDraft(stored, entries);
}

function entry(id: string, parentId?: string): CategoryEntry {
  return {
    id,
    name: id,
    path: id,
    depth: parentId === undefined ? 0 : 1,
    ...(parentId === undefined ? {} : { parentId }),
    class: "expense",
    archived: false,
    uncategorized: false,
  };
}

function bucket(id: string, share_bp: number, category_ids: string[]): Bucket {
  return {
    id,
    name: id,
    share_bp,
    takes_savings: false,
    takes_goals: false,
    at_least: false,
    category_ids,
  };
}
