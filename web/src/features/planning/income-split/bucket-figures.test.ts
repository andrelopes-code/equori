import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import type { CategoryEntry } from "@/features/categories";
import {
  bucketFigures,
  bucketGroups,
  bucketResolver,
  bucketStatus,
} from "@/features/planning/income-split/bucket-figures";
import type { PlanDraftRow } from "@/features/planning/budget-plan/plan-math";

type Bucket = components["schemas"]["BudgetPlanBucket"];

const brl = (amount: number) => ({ amount, currency: "BRL" });

function entry(id: string, path: string, parentId?: string): CategoryEntry {
  return {
    id,
    name: path.split(" › ").at(-1) ?? path,
    path,
    depth: path.split(" › ").length - 1,
    ...(parentId === undefined ? {} : { parentId }),
    class: "expense",
    archived: false,
    uncategorized: false,
  };
}

function row(id: string, draft: number, counted = true): PlanDraftRow {
  return {
    category_id: id,
    budget_id: `b-${id}`,
    planned: brl(draft),
    last_month: brl(10),
    average: brl(20),
    counted,
    draft,
  };
}

function bucket(
  id: string,
  share: number,
  categories: string[],
  savings = false,
): Bucket {
  return {
    id,
    name: id,
    share_bp: share,
    takes_savings: savings,
    category_ids: categories,
    planned: brl(0),
    spent: brl(id === "needs" ? 700 : 300),
  };
}

const entries = [
  entry("food", "Food"),
  entry("restaurants", "Food › Restaurants", "food"),
  entry("gym", "Gym"),
];
const buckets = [
  bucket("needs", 6000, ["food"]),
  bucket("fun", 2500, ["restaurants"]),
  bucket("freedom", 1500, [], true),
];

describe("bucketResolver", () => {
  it("takes the nearest category placed in a bucket", () => {
    const resolve = bucketResolver(buckets, entries);

    expect(["food", "restaurants", "gym"].map((id) => resolve(id)?.id)).toEqual(
      ["needs", "fun", undefined],
    );
  });
});

describe("bucketFigures", () => {
  it("splits the reference, sums the draft and adds the savings", () => {
    const rows = [
      row("food", 1000),
      row("restaurants", 400, false),
      row("gym", 50),
    ];

    const got = bucketFigures(buckets, entries, rows, 100001, 200);

    expect(
      got.buckets.map((b) => [b.id, b.target, b.planned, b.spent]),
    ).toEqual([
      ["needs", 60001, 1000, 700],
      ["fun", 25000, 0, 300],
      ["freedom", 15000, 200, 300],
    ]);
    expect(got.outsidePlanned).toBe(50);
  });

  it("leaves the targets out without a reference", () => {
    const got = bucketFigures(buckets, entries, [], undefined, 0);

    expect(got.buckets.map((b) => b.target)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
  });
});

describe("bucketGroups", () => {
  it("groups the rows by bucket in method order, then the rest", () => {
    const rows = [row("gym", 50), row("restaurants", 400), row("food", 1000)];

    const got = bucketGroups(buckets, entries, rows, "Outside");

    expect(
      got.map((g) => [g.id, g.name, g.draft, g.lines.map((l) => l.label)]),
    ).toEqual([
      ["needs", "needs", 1000, ["Food"]],
      ["fun", "fun", 400, ["Food › Restaurants"]],
      ["outside", "Outside", 50, ["Gym"]],
    ]);
  });
});

describe("bucketStatus", () => {
  it.each([
    [1000, 600, 400, { kind: "left", amount: 400 }],
    [1000, 600, 1200, { kind: "over", amount: 200 }],
    [1000, 1000, 0, { kind: "left", amount: 0 }],
    [undefined, 600, 400, undefined],
  ] as const)(
    "target %s, planned %s, spent %s",
    (target, planned, spent, want) => {
      expect(bucketStatus(target, planned, spent)).toEqual(want);
    },
  );
});
