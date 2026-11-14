import { describe, expect, it } from "vitest";

import { apportion } from "@/features/transactions/note-entry/apportion";

// The cases of TestApportion (internal/ledger/domain/apportion_test.go), except the overflow one.
describe("apportion", () => {
  const cases: [string, number, number[], number[]][] = [
    ["two orders", 251, [300000, 300500], [125, 126]],
    ["tie goes to the lower index", 100, [1, 1, 1], [34, 33, 33]],
    ["zero amount", 0, [5, 7], [0, 0]],
    ["zero weights", 10, [0, 0], [0, 0]],
    ["zero weight takes nothing", 7, [0, 3, 0, 4], [0, 3, 0, 4]],
    ["one unit", 1, [1, 1], [1, 0]],
    ["one weight", 9, [4], [9]],
  ];

  it.each(cases)("%s", (_name, amount, weights, want) => {
    expect(apportion(amount, weights)).toEqual(want);
  });
});
