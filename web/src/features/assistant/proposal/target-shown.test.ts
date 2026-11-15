import { describe, expect, it } from "vitest";

import { targetShownElsewhere } from "@/features/assistant/proposal/target-shown";

describe("targetShownElsewhere", () => {
  it.each([
    { name: "no target", preview: { action: "a", changes: [] }, want: false },
    {
      name: "the description of an item",
      preview: {
        action: "a",
        target: "Outback",
        changes: [],
        items: [{ description: "Outback" }],
      },
      want: true,
    },
    {
      name: "the value of a change",
      preview: {
        action: "a",
        target: "iFood",
        changes: [{ field: "rule", after: { text: "iFood" } }],
      },
      want: true,
    },
    {
      name: "a name drawn nowhere else",
      preview: {
        action: "a",
        target: "XP",
        changes: [{ field: "account", after: { text: "XP Investimentos" } }],
      },
      want: false,
    },
  ])("$name", ({ preview, want }) => {
    expect(targetShownElsewhere(preview)).toBe(want);
  });
});
