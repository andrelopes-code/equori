import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import {
  actionItems,
  isSelectable,
  suggestionItems,
} from "@/features/accounts/review-selection";

type ExternalRecord = components["schemas"]["ExternalRecord"];

describe("review selection (S293)", () => {
  const p = record("p", "probable", ["t1", "t2"]);
  const a = record("a", "ambiguous", ["t1", "t2"]);
  const g = record("g", "group", ["t3"]);
  const q = record("q", "probable", []);

  it("excludes a group line from the selection", () => {
    expect([isSelectable(g), isSelectable(a)]).toEqual([false, true]);
  });

  it("matches each selected probable line to its first candidate", () => {
    expect(suggestionItems([p, a, g, q], ["a", "p", "q", "g"])).toEqual([
      {
        record_id: "p",
        resolution: { action: "match", transaction_id: "t1" },
      },
    ]);
  });

  it("applies one action to the selected lines in queue order", () => {
    expect(actionItems([p, a, g], ["g", "a", "p"], "discard")).toEqual([
      { record_id: "p", resolution: { action: "discard" } },
      { record_id: "a", resolution: { action: "discard" } },
    ]);
  });
});

function record(
  id: string,
  reason: ExternalRecord["review_reason"],
  scored: string[],
): ExternalRecord {
  return {
    id,
    batch_id: "b1",
    account_id: "acc",
    date: "2026-09-10",
    amount: { amount: -4500, currency: "BRL" },
    description: id,
    state: "needs_review",
    candidates: scored,
    review_reason: reason,
    scored_candidates: scored.map((transaction_id) => ({
      transaction_id,
      score: 9,
      amount: "identical",
      date: "same_day",
      counterparty: "unknown",
    })),
  } as ExternalRecord;
}
