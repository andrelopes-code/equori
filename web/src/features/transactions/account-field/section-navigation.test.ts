import { describe, expect, it } from "vitest";

import { nextPosition } from "@/features/transactions/account-field/section-navigation";
import type {
  GroupShape,
  NavigationKey,
  Position,
} from "@/features/transactions/account-field/section-navigation";

// A list of two rows, a grid of three cards in two columns, a list of one row.
const groups: GroupShape[] = [
  { size: 2, columns: 1 },
  { size: 3, columns: 2 },
  { size: 1, columns: 1 },
];

describe("nextPosition", () => {
  const cases: [string, NavigationKey, Position, Position | null][] = [
    [
      "Down inside a list",
      "ArrowDown",
      { group: 0, index: 0 },
      { group: 0, index: 1 },
    ],
    [
      "Down past the list",
      "ArrowDown",
      { group: 0, index: 1 },
      { group: 1, index: 0 },
    ],
    [
      "Down a row of the grid",
      "ArrowDown",
      { group: 1, index: 0 },
      { group: 1, index: 2 },
    ],
    [
      "Down from the last row of the grid",
      "ArrowDown",
      { group: 1, index: 1 },
      { group: 2, index: 0 },
    ],
    ["Down at the end", "ArrowDown", { group: 2, index: 0 }, null],
    [
      "Up inside the grid",
      "ArrowUp",
      { group: 1, index: 2 },
      { group: 1, index: 0 },
    ],
    [
      "Up from the first row of the grid",
      "ArrowUp",
      { group: 1, index: 1 },
      { group: 0, index: 1 },
    ],
    ["Up at the start", "ArrowUp", { group: 0, index: 0 }, null],
    [
      "Right inside the grid",
      "ArrowRight",
      { group: 1, index: 0 },
      { group: 1, index: 1 },
    ],
    [
      "Right at the end of the grid",
      "ArrowRight",
      { group: 1, index: 2 },
      null,
    ],
    ["Right in a list", "ArrowRight", { group: 0, index: 0 }, null],
    [
      "Left inside the grid",
      "ArrowLeft",
      { group: 1, index: 1 },
      { group: 1, index: 0 },
    ],
    ["Left in a list", "ArrowLeft", { group: 0, index: 1 }, null],
    ["Home", "Home", { group: 2, index: 0 }, { group: 0, index: 0 }],
    ["End", "End", { group: 0, index: 0 }, { group: 2, index: 0 }],
  ];

  it.each(cases)("%s", (_name, key, at, want) => {
    expect(nextPosition(key, at, groups)).toEqual(want);
  });
});
