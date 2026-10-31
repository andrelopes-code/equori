import { describe, expect, it } from "vitest";

import { syncCounts } from "@/features/accounts/sync-counts";

const zero = {
  received: 0,
  ignored: 0,
  matched: 0,
  created: 0,
  needs_review: 0,
  discarded: 0,
  updated: 0,
  withdrawn: 0,
  re_identified: 0,
};

describe("syncCounts", () => {
  it("returns the non-zero counts in display order", () => {
    expect(
      syncCounts({
        ...zero,
        received: 5,
        ignored: 1,
        matched: 1,
        created: 2,
        updated: 3,
        withdrawn: 1,
      }),
    ).toEqual([
      { key: "created", count: 2 },
      { key: "matched", count: 1 },
      { key: "updated", count: 3 },
      { key: "withdrawn", count: 1 },
    ]);
  });

  it("returns nothing when every count is zero", () => {
    expect(syncCounts(zero)).toEqual([]);
  });
});
