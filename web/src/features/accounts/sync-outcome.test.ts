import { describe, expect, it } from "vitest";

import type { components } from "@/api/schema.gen";
import { recordOutcome } from "@/features/accounts/sync-outcome";

type ExternalRecord = components["schemas"]["ExternalRecord"];

describe("recordOutcome", () => {
  const cases: [Partial<ExternalRecord>, string][] = [
    [{ state: "matched", decision: "linked" }, "links.decision.linked"],
    [{ state: "withdrawn", decision: "withdrawn" }, "links.decision.withdrawn"],
    [{ state: "matched", review_reason: "changed" }, "links.outcome.changed"],
    [
      { state: "needs_review", review_reason: "probable" },
      "batch.state.needs_review",
    ],
    [{ state: "created" }, "batch.state.created"],
    [{ state: "withdrawn" }, "batch.state.withdrawn"],
  ];

  it.each(cases)("maps %j to %s", (record, key) => {
    expect(recordOutcome(record as ExternalRecord)).toBe(key);
  });
});
