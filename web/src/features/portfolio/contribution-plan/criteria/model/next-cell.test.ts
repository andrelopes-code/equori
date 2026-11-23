import { describe, expect, it } from "vitest";

import { nextCell } from "@/features/portfolio/contribution-plan/criteria/model/next-cell";

describe("nextCell", () => {
  it.each([
    ["ArrowRight", 1, 2],
    ["ArrowLeft", 1, 0],
    ["ArrowDown", 2, 1],
    ["ArrowUp", 0, 1],
    ["Home", 1, 0],
    ["End", 1, 3],
  ])("%s moves from the middle", (key, row, column) => {
    expect(nextCell(key, { row: 1, column: 1 }, 3, 4)).toEqual({ row, column });
  });

  it.each([
    ["ArrowRight", 2, 3],
    ["ArrowDown", 2, 3],
  ])("%s stays at the end", (key, row, column) => {
    expect(nextCell(key, { row: 2, column: 3 }, 3, 4)).toEqual({ row, column });
  });

  it.each(["ArrowLeft", "ArrowUp"])("%s stays at the start", (key) => {
    expect(nextCell(key, { row: 0, column: 0 }, 3, 4)).toEqual({
      row: 0,
      column: 0,
    });
  });

  it("leaves another key alone", () => {
    expect(nextCell("Tab", { row: 0, column: 0 }, 3, 4)).toBeUndefined();
  });
});
