import type { KeyboardEvent } from "react";
import { describe, expect, it } from "vitest";

import { planShortcut } from "@/features/planning/budget-plan/model/plan-keys";

function press(key: string, ctrl: boolean, target: EventTarget | null = null) {
  return { key, ctrlKey: ctrl, metaKey: false, target } as KeyboardEvent;
}

describe("planShortcut", () => {
  it.each([
    ["save", press("s", true), true, true, "save"],
    ["save while read-only", press("S", true), false, true, null],
    ["undo", press("z", true), true, true, "undo"],
    ["undo without history", press("z", true), true, false, null],
    [
      "undo in an input",
      press("z", true, document.createElement("input")),
      true,
      true,
      null,
    ],
    ["plain key", press("s", false), true, true, null],
  ] as const)("%s", (_, event, editable, canUndo, want) => {
    expect(planShortcut(event, editable, canUndo)).toBe(want);
  });
});
