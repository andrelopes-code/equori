import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import type { CategoryEntry } from "@/features/categories";
import {
  applyPreset,
  bucketsPayload,
  bucketCounts,
  canSave,
  changeBucket,
  checkState,
  choiceOf,
  expenseBranches,
  initialDraft,
  keepChoices,
  outsideRoots,
  toggleChoice,
  totalBp,
  withChoice,
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
    takes_goals: false,
    at_least: false,
    category_ids: ["food"],
    planned: brl,
    spent: brl,
  },
  {
    id: "b2",
    name: "Fun",
    share_bp: 4000,
    takes_savings: true,
    takes_goals: false,
    at_least: false,
    category_ids: ["market"],
    planned: brl,
    spent: brl,
  },
];

describe("initialDraft", () => {
  it("reads the stored method and defaults the rest", () => {
    const draft = initialDraft(stored, entries);

    expect(draft.buckets).toEqual([
      { key: "b1", name: "Needs", share: "60", measure: "ceiling" },
      { key: "b2", name: "Fun", share: "40", measure: "savings" },
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

    expect(got.buckets.map((b) => [b.key, b.name, b.share, b.measure])).toEqual(
      [
        ["b1", "Needs", "50", "ceiling"],
        ["new1", "buckets.name.wants", "30", "ceiling"],
        ["new2", "buckets.name.savings", "20", "savings"],
      ],
    );
    expect(got.choices.get("food")).toBe("b1");
    expect(got.choices.get("market")).toBe("same");
  });
});

describe("changeBucket", () => {
  const buckets = [
    { key: "a", name: "A", share: "50", measure: "goals" as const },
    { key: "b", name: "B", share: "30", measure: "floor" as const },
    { key: "c", name: "C", share: "20", measure: "savings" as const },
  ];

  it("moves a measure one bucket holds to the new bucket", () => {
    const got = changeBucket(buckets, "b", { measure: "goals" });

    expect(got.map((b) => b.measure)).toEqual(["ceiling", "goals", "savings"]);
  });

  it("leaves the other buckets on a floor or a ceiling", () => {
    const got = changeBucket(buckets, "c", { measure: "floor" });

    expect(got.map((b) => b.measure)).toEqual(["goals", "floor", "floor"]);
  });
});

describe("bucketsPayload", () => {
  it("writes the flags of each measure; the goals bucket is a floor", () => {
    const draft = {
      buckets: [
        { key: "a", name: "A", share: "50", measure: "goals" as const },
        { key: "b", name: "B", share: "50", measure: "floor" as const },
      ],
      choices: new Map<string, string>(),
      roots: new Set<string>(),
    };

    expect(
      bucketsPayload(draft).buckets.map((b) => [
        b.takes_savings,
        b.takes_goals,
        b.at_least,
      ]),
    ).toEqual([
      [false, true, true],
      [false, false, true],
    ]);
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
        buckets: [{ key: "x", name: "x", share: "99,9", measure: "ceiling" }],
      }),
    ).toBe(false);
    expect(
      totalBp([{ key: "x", name: "x", share: "abc", measure: "ceiling" }]),
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
        takes_goals: false,
        at_least: false,
        category_ids: ["food"],
      },
      {
        name: "Fun",
        share_bp: 4000,
        takes_savings: true,
        takes_goals: false,
        at_least: false,
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

describe("choiceOf and withChoice", () => {
  it("reads a category's bucket and moves it to another", () => {
    expect(choiceOf(stored, "market", false)).toBe("b2");
    expect(choiceOf(stored, "gym", true)).toBe("outside");
    expect(choiceOf(stored, "bakery", false)).toBe("same");

    const moved = withChoice(stored, "market", "b1");

    expect(moved.buckets.map((b) => b.category_ids)).toEqual([
      ["food", "market"],
      [],
    ]);
    expect(
      withChoice(stored, "food", "outside").buckets[0]?.category_ids,
    ).toEqual([]);
  });
});

describe("outsideRoots", () => {
  it("lists the top-level categories left outside", () => {
    const draft = initialDraft(stored, entries);

    expect(
      outsideRoots(draft, expenseBranches(entries)).map((e) => e.id),
    ).toEqual(["gym"]);
  });
});

describe("checklist choices", () => {
  const parents = new Map(entries.map((e) => [e.id, e.parentId]));

  it("reads each category against one bucket", () => {
    const draft = initialDraft(stored, entries);

    expect(
      ["food", "market", "gym"].map((id) =>
        checkState(draft, parents, id, "b1"),
      ),
    ).toEqual(["own", "elsewhere", "elsewhere"]);
    expect(checkState(draft, parents, "market", "b2")).toBe("own");
  });

  it("moves a category in and out of a bucket", () => {
    const draft = initialDraft(stored, entries);

    // market leaves Fun and follows food into Needs.
    const out = toggleChoice(draft, parents, "market", "b2");
    expect(out.get("market")).toBe("same");
    expect(
      checkState({ ...draft, choices: out }, parents, "market", "b1"),
    ).toBe("inherited");
    // A click on an inherited category changes nothing.
    expect(
      toggleChoice({ ...draft, choices: out }, parents, "market", "b1"),
    ).toEqual(out);
    // gym joins Fun; food leaves Needs for outside.
    expect(toggleChoice(draft, parents, "gym", "b2").get("gym")).toBe("b2");
    expect(toggleChoice(draft, parents, "food", "b1").get("food")).toBe(
      "outside",
    );
  });

  it("counts the categories each bucket draws from", () => {
    const draft = initialDraft(stored, entries);
    const counts = bucketCounts(draft, parents, expenseBranches(entries));

    expect([...counts]).toEqual([
      ["b1", 1],
      ["b2", 1],
    ]);
  });
});
