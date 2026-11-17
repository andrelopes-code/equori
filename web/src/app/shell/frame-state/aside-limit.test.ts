import { describe, expect, it } from "vitest";

import { asideLimit } from "@/app/shell/frame-state/aside-limit";

describe("asideLimit", () => {
  it.each(cases)(
    "is $expected for $room px of page and pane in a $shell px shell",
    ({ shell, room, expected }) => {
      expect(asideLimit(shell, room, 0.3, 0.6)).toBe(expected);
    },
  );
});

const cases = [
  // 1060 px for both: the page keeps 600 px, the pane takes the other 460 px.
  { shell: 1280, room: 1060, expected: 0.35 },
  // A wide shell reaches the family's own limit.
  { shell: 2560, room: 2340, expected: 0.6 },
  // No room for a page of 600 px: the pane keeps its smallest share.
  { shell: 1200, room: 900, expected: 0.3 },
  { shell: 0, room: 0, expected: 0.3 },
];
