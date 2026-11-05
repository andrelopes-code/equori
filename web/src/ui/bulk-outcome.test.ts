import { describe, expect, it } from "vitest";

import { bulkOutcome } from "@/ui/bulk-outcome";

describe("bulkOutcome", () => {
  it.each([
    {
      name: "counts the done items and keeps the refused ones",
      results: [
        { id: "a", status: "resolved" },
        { id: "b", status: "record_resolved" },
        { id: "c", status: "resolved" },
      ],
      doneStatus: "resolved",
      expected: { done: 2, refused: [{ id: "b", status: "record_resolved" }] },
    },
    {
      name: "answers an empty result",
      results: [],
      doneStatus: "voided",
      expected: { done: 0, refused: [] },
    },
  ])("$name", ({ results, doneStatus, expected }) => {
    expect(bulkOutcome(results, doneStatus)).toEqual(expected);
  });
});
