import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import type { CategoryEntry } from "@/features/categories";
import {
  applyPreset,
  bucketsPayload,
  canSave,
  expenseBranches,
  initialDraft,
  keepChoices,
  totalBp,
} from "@/features/planning/income-split/bucket-draft";

type Bucket = components["schemas"]["BudgetPlanBucket"];

const brl = { amount: 0, currency: "BRL" };

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

const entries = [entry("food"), entry("market", "food"), entry("gym")];
const stored: Bucket[] = [
  {
    id: "b1",
    name: "Needs",
    share_bp: 6000,
    takes_savings: false,
    category_ids: ["food"],
    planned: brl,
    spent: brl,
  },
  {
    id: "b2",
    name: "Fun",
    share_bp: 4000,
    takes_savings: true,
    category_ids: ["market"],
    planned: brl,
    spent: brl,
  },
];

describe("initialDraft", () => {
  it("reads the stored method and defaults the rest", () => {
    const draft = initialDraft(stored, entries);

    expect(draft.buckets).toEqual([
      { key: "b1", name: "Needs", share: "60", takesSavings: false },
      { key: "b2", name: "Fun", share: "40", takesSavings: true },
    ]);
    expect([...draft.choices]).toEqual([
      ["food", "b1"],
      ["market", "b2"],
      ["gym", "outside"],
    ]);
  });
});

describe("applyPreset", () => {
  it("keeps the key of a bucket whose name stays and resets the others", () => {
    let n = 0;
    const draft = initialDraft(stored, entries);

    const got = applyPreset(
      draft,
      "503020",
      (key) => (key === "buckets.name.needs" ? "Needs" : key),
      () => `new${String(++n)}`,
    );

    expect(
      got.buckets.map((b) => [b.key, b.name, b.share, b.takesSavings]),
    ).toEqual([
      ["b1", "Needs", "50", false],
      ["new1", "buckets.name.wants", "30", false],
      ["new2", "buckets.name.savings", "20", true],
    ]);
    expect(got.choices.get("food")).toBe("b1");
    expect(got.choices.get("market")).toBe("same");
  });
});

describe("keepChoices", () => {
  it("returns a dropped root outside and a dropped subcategory to its parent", () => {
    const draft = initialDraft(stored, entries);

    const got = keepChoices(draft, []);

    expect([...got.values()]).toEqual(["outside", "same", "outside"]);
  });
});

describe("totalBp and canSave", () => {
  it("sums the typed shares and allows only the whole", () => {
    const draft = initialDraft(stored, entries);

    expect(totalBp(draft.buckets)).toBe(10_000);
    expect(canSave(draft)).toBe(true);
    expect(
      canSave({
        ...draft,
        buckets: [{ key: "x", name: "x", share: "99,9", takesSavings: false }],
      }),
    ).toBe(false);
    expect(
      totalBp([{ key: "x", name: "x", share: "abc", takesSavings: false }]),
    ).toBeUndefined();
    expect(canSave({ ...draft, buckets: [] })).toBe(false);
  });
});

describe("bucketsPayload", () => {
  it("lists each bucket with the categories placed in it", () => {
    const got = bucketsPayload(initialDraft(stored, entries));

    expect(got.buckets).toEqual([
      {
        name: "Needs",
        share_bp: 6000,
        takes_savings: false,
        category_ids: ["food"],
      },
      {
        name: "Fun",
        share_bp: 4000,
        takes_savings: true,
        category_ids: ["market"],
      },
    ]);
  });
});

describe("expenseBranches", () => {
  it("puts every open expense category under its top-level category", () => {
    const deep = { ...entry("bakery", "market"), depth: 2 };
    const income = { ...entry("salary"), class: "income" as const };
    const archived = { ...entry("old"), archived: true };

    const got = expenseBranches([...entries, deep, income, archived]);

    expect(
      got.map((b) => [b.root.id, b.subcategories.map((s) => s.id)]),
    ).toEqual([
      ["food", ["market", "bakery"]],
      ["gym", []],
    ]);
  });
});
